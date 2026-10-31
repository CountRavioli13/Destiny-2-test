// GET /api/activities?type=3&id=4611…&char=2305…  →  a character's recent activities
const { bungie, handler, readMember, HttpError } = require("../lib/bungie");

module.exports = handler(async (query) => {
  const { type, id } = readMember(query);
  const char = query.get("char") || "";
  if (!/^\d{1,20}$/.test(char)) throw new HttpError(400, "Missing or invalid character id.");

  const res = await bungie(
    `/Destiny2/${type}/Account/${id}/Character/${char}/Stats/Activities/?count=12&mode=0&page=0`
  );

  const val = (a, key) => a.values?.[key]?.basic?.value ?? null;

  return (res?.activities || []).map((a) => ({
    when: a.period,
    instanceId: a.activityDetails?.instanceId,
    mapHash: a.activityDetails?.referenceId ?? null,
    playlistHash: a.activityDetails?.directorActivityHash ?? null,
    pvp: (a.activityDetails?.modes || []).includes(5),
    completed: val(a, "completed") === 1,
    completionReason: val(a, "completionReason"),
    standing: val(a, "standing"),
    kills: val(a, "kills"),
    deaths: val(a, "deaths"),
    assists: val(a, "assists"),
    duration: val(a, "activityDurationSeconds")
  }));
}, 60);
