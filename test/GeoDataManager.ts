import { AttributeValue, QueryCommandInput, QueryCommandOutput } from "@aws-sdk/client-dynamodb";
import { expect } from "chai";
import { GeoDataManager, GeoDataManagerConfiguration } from "../src";
import { captureClient, rejectingClient } from "./support/captureClient";
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

describe("GeoDataManager query options", () => {
  it("sends the caller QueryInput with every geohash query", async () => {
    const { inputs, manager } = setup();

    await manager.queryRadius({
      CenterPoint: LONDON,
      RadiusInMeter: 15000,
      QueryInput: { FilterExpression: "fakeGeo = :f", ExpressionAttributeValues: { ":f": { BOOL: false } } }
    });

    expect(inputs.length).to.be.at.least(1);
    for (const input of inputs) {
      expect(input.FilterExpression).to.equal("fakeGeo = :f");
      expect(input.TableName).to.equal("MyTable");
    }
  });

  it("reads latitude-first geoJson when longitudeFirst is false", async () => {
    const inputs: QueryCommandInput[] = [];
    const latFirst = (id: string, latitude: number, longitude: number): Record<string, AttributeValue> => ({
      rangeKey: { S: id },
      geoJson: { S: JSON.stringify({ type: "Point", coordinates: [latitude, longitude] }) }
    });
    const client = captureClient<QueryCommandInput, QueryCommandOutput>(inputs, {
      $metadata: {},
      Items: [latFirst("london", 51.51, -0.13), latFirst("paris", 48.8566, 2.3522)]
    });
    const config = new GeoDataManagerConfiguration(client, "MyTable");
    config.longitudeFirst = false;

    const result = await new GeoDataManager(config).queryRadius({ CenterPoint: LONDON, RadiusInMeter: 1000 });

    expect(ids(result)).to.deep.equal(["london"]);
  });

  it("returns an empty list when the query pages have no Items", async () => {
    const client = captureClient<QueryCommandInput, QueryCommandOutput>([], { $metadata: {} });
    const manager = new GeoDataManager(new GeoDataManagerConfiguration(client, "MyTable"));

    expect(await manager.queryRadius({ CenterPoint: LONDON, RadiusInMeter: 1000 })).to.deep.equal([]);
  });

  it("finds points around a center with a negative geohash", async () => {
    const inputs: QueryCommandInput[] = [];
    const client = captureClient<QueryCommandInput, QueryCommandOutput>(inputs, {
      $metadata: {},
      Items: [item("nyc", 40.7, -74), item("boston", 42.36, -71.06)]
    });
    const manager = new GeoDataManager(new GeoDataManagerConfiguration(client, "MyTable"));

    const result = await manager.queryRadius({ CenterPoint: { latitude: 40.7, longitude: -74 }, RadiusInMeter: 5000 });

    expect(queriesCover(inputs, Long.fromString("-8520148344981272079"))).to.equal(true);
    expect(ids(result)).to.deep.equal(["nyc"]);
  });
});

describe("GeoDataManager single-item operations", () => {
  const output = { $metadata: { httpStatusCode: 200 } };
  const managerFor = () => new GeoDataManager(new GeoDataManagerConfiguration(captureClient([], output), "MyTable"));
  const point = { RangeKeyValue: { S: "1" }, GeoPoint: LONDON };

  it("returns the client output for each operation", async () => {
    const manager = managerFor();

    expect(await manager.putPoint({ ...point, PutItemInput: {} })).to.equal(output);
    expect(await manager.getPoint({ ...point, GetItemInput: { TableName: "", Key: {} } })).to.equal(output);
    expect(await manager.updatePoint({ ...point, UpdateItemInput: { TableName: "", Key: {} } })).to.equal(output);
    expect(await manager.deletePoint(point)).to.equal(output);
    expect(await manager.batchWritePoints([{ ...point, PutItemInput: {} }])).to.equal(output);
  });

  it("rejects with the client error", async () => {
    const error = new Error("ProvisionedThroughputExceededException");
    const manager = new GeoDataManager(new GeoDataManagerConfiguration(rejectingClient(error), "MyTable"));

    const outcomes = await Promise.allSettled([
      manager.putPoint({ ...point, PutItemInput: {} }),
      manager.getPoint({ ...point, GetItemInput: { TableName: "", Key: {} } }),
      manager.deletePoint(point),
      manager.queryRadius({ CenterPoint: LONDON, RadiusInMeter: 1000 }),
      manager.queryRectangle({ MinPoint: LONDON, MaxPoint: { latitude: 51.6, longitude: 0 } })
    ]);

    for (const outcome of outcomes) {
      expect(outcome.status).to.equal("rejected");
      expect(outcome.status === "rejected" && outcome.reason).to.equal(error);
    }
  });
});

describe("GeoDataManager.queryRadius edge of the circle", () => {
  // About 111195 m per degree of latitude, and 111195 * cos(51.51°) ≈ 69200 m per degree of longitude in London.
  const north = (meters: number) => LONDON.latitude + meters / 111195;
  const east = (meters: number) => LONDON.longitude + meters / 69200;

  it("keeps a point just inside the radius and drops one just outside", async () => {
    const client = captureClient<QueryCommandInput, QueryCommandOutput>([], {
      $metadata: {},
      Items: [item("inside", north(950), LONDON.longitude), item("outside", north(1050), LONDON.longitude)]
    });
    const manager = new GeoDataManager(new GeoDataManagerConfiguration(client, "MyTable"));

    const result = await manager.queryRadius({ CenterPoint: LONDON, RadiusInMeter: 1000 });

    expect(ids(result)).to.deep.equal(["inside"]);
  });

  it("drops a point in the corner of the bounding box, outside the circle", async () => {
    const client = captureClient<QueryCommandInput, QueryCommandOutput>([], {
      $metadata: {},
      Items: [item("corner", north(900), east(900))]
    });
    const manager = new GeoDataManager(new GeoDataManagerConfiguration(client, "MyTable"));

    expect(await manager.queryRadius({ CenterPoint: LONDON, RadiusInMeter: 1000 })).to.deep.equal([]);
  });
});
