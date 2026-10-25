import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { expect } from "chai";
import { GeoDataManagerConfiguration, GeoTableUtil } from "../../src";

describe("GeoTableUtil.getCreateTableRequest", () => {
  it("builds the table and the geohash index from the default configuration", () => {
    const config = new GeoDataManagerConfiguration(new DynamoDBClient({ region: "dummy" }), "MyTable");

    expect(GeoTableUtil.getCreateTableRequest(config)).to.deep.equal({
      TableName: "MyTable",
      ProvisionedThroughput: { ReadCapacityUnits: 10, WriteCapacityUnits: 5 },
      KeySchema: [
        { KeyType: "HASH", AttributeName: "hashKey" },
        { KeyType: "RANGE", AttributeName: "rangeKey" }
      ],
      AttributeDefinitions: [
        { AttributeName: "hashKey", AttributeType: "N" },
        { AttributeName: "rangeKey", AttributeType: "S" },
        { AttributeName: "geohash", AttributeType: "N" }
      ],
      LocalSecondaryIndexes: [{
        IndexName: "geohash-index",
        KeySchema: [
          { KeyType: "HASH", AttributeName: "hashKey" },
          { KeyType: "RANGE", AttributeName: "geohash" }
        ],
        Projection: { ProjectionType: "ALL" }
      }]
    });
  });

  it("uses the configured attribute and index names", () => {
    const config = new GeoDataManagerConfiguration(new DynamoDBClient({ region: "dummy" }), "Other");
    config.hashKeyAttributeName = "hk";
    config.rangeKeyAttributeName = "rk";
    config.geohashAttributeName = "gh";
    config.geohashIndexName = "gh-index";

    const request = GeoTableUtil.getCreateTableRequest(config);

    expect(request.TableName).to.equal("Other");
    expect(request.KeySchema.map((k) => k.AttributeName)).to.deep.equal(["hk", "rk"]);
    expect(request.AttributeDefinitions.map((a) => a.AttributeName)).to.deep.equal(["hk", "rk", "gh"]);
    expect(request.LocalSecondaryIndexes[0].IndexName).to.equal("gh-index");
    expect(request.LocalSecondaryIndexes[0].KeySchema.map((k) => k.AttributeName)).to.deep.equal(["hk", "gh"]);
  });

  it("returns a new object on each call, so callers can change it safely", () => {
    const config = new GeoDataManagerConfiguration(new DynamoDBClient({ region: "dummy" }), "MyTable");

    const first = GeoTableUtil.getCreateTableRequest(config);
    first.ProvisionedThroughput.ReadCapacityUnits = 2;

    expect(GeoTableUtil.getCreateTableRequest(config).ProvisionedThroughput.ReadCapacityUnits).to.equal(10);
  });
});
