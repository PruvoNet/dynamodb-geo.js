import { AttributeValue, QueryCommandInput, QueryCommandOutput } from "@aws-sdk/client-dynamodb";
import { expect } from "chai";
import { GeoDataManager, GeoDataManagerConfiguration } from "../src";
import { captureClient } from "./support/captureClient";
import Long from "long";

const LONDON = { latitude: 51.51, longitude: -0.13 };
const LONDON_GEOHASH = Long.fromString("5221366118452580119");

const item = (id: string, latitude: number, longitude: number): Record<string, AttributeValue> => ({
  rangeKey: { S: id },
  geoJson: { S: JSON.stringify({ type: "Point", coordinates: [longitude, latitude] }) }
});

// Every query returns the same items, so ids are de-duplicated before the assertions.
const setup = () => {
  const inputs: QueryCommandInput[] = [];
  const items = [item("london", 51.51, -0.13), item("greenwich", 51.4769, 0.0005), item("paris", 48.8566, 2.3522)];
  const client = captureClient<QueryCommandInput, QueryCommandOutput>(inputs, { $metadata: {}, Items: items });
  const manager = new GeoDataManager(new GeoDataManagerConfiguration(client, "MyTable"));
  return { inputs, manager };
};

const ids = (list: Record<string, AttributeValue>[]) =>
  list.map((i) => i.rangeKey.S).filter((id, index, all) => all.indexOf(id) === index).sort();

const queriesCover = (inputs: QueryCommandInput[], geohash: Long) => inputs.some((input) => {
  const [min, max] = input.KeyConditions.geohash.AttributeValueList.map((v) => Long.fromString(v.N));
  return min.lessThanOrEqual(geohash) && geohash.lessThanOrEqual(max);
});

describe("GeoDataManager.queryRadius", () => {
  it("queries ranges around the center and keeps only points inside the radius", async () => {
    const { inputs, manager } = setup();

    const result = await manager.queryRadius({ CenterPoint: LONDON, RadiusInMeter: 15000 });

    expect(queriesCover(inputs, LONDON_GEOHASH)).to.equal(true);
    expect(ids(result)).to.deep.equal(["greenwich", "london"]);
  });

  it("drops a point just outside a small radius", async () => {
    const { manager } = setup();

    const result = await manager.queryRadius({ CenterPoint: LONDON, RadiusInMeter: 1000 });

    expect(ids(result)).to.deep.equal(["london"]);
  });
});

describe("GeoDataManager.queryRectangle", () => {
  it("keeps only points inside the rectangle", async () => {
    const { inputs, manager } = setup();

    const result = await manager.queryRectangle({
      MinPoint: { latitude: 51.4, longitude: -0.3 },
      MaxPoint: { latitude: 51.6, longitude: 0.1 }
    });

    expect(queriesCover(inputs, LONDON_GEOHASH)).to.equal(true);
    expect(ids(result)).to.deep.equal(["greenwich", "london"]);
  });
});
