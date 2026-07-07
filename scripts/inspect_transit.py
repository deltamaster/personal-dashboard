#!/usr/bin/env python3
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from poster_oss_lib import apply_stack_preset, load_dotenv_local, resolve_credentials
from tablestore import Direction, INF_MAX, INF_MIN, OTSClient

load_dotenv_local()
ots_endpoint, ots_instance, _, _ = apply_stack_preset("cn-shanghai")
ak, sk, token = resolve_credentials()
client = OTSClient(ots_endpoint, ak, sk, ots_instance, sts_token=token)


def scan(table, pk):
    rows = []
    start = [(pk, INF_MIN)]
    while True:
        _, nxt, rlist, _ = client.get_range(
            table, Direction.FORWARD, start, [(pk, INF_MAX)], limit=100
        )
        for row in rlist:
            d = {n: v for n, v in row.primary_key}
            for item in row.attribute_columns:
                if len(item) >= 2:
                    d[item[0]] = item[1]
            rows.append(d)
        if nxt is None:
            break
        start = nxt
    return rows


flights = scan("pd_flights", "flight_id")
trains = scan("pd_trains", "train_id")

dep = sorted({str(f.get("departure_city", "")) for f in flights if f.get("departure_city")})
arr = sorted({str(f.get("arrival_city", "")) for f in flights if f.get("arrival_city")})
stations = sorted(
    {
        str(x)
        for t in trains
        for x in (t.get("departure_station"), t.get("arrival_station"))
        if x
    }
)

out = {
    "flight_departure_cities": dep,
    "flight_arrival_cities": arr,
    "train_stations": stations,
    "flight_count": len(flights),
    "train_count": len(trains),
}
with open("scripts/transit-locations-audit.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print("wrote scripts/transit-locations-audit.json")
