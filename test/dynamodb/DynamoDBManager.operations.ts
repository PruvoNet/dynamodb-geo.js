import {
  BatchWriteItemCommandInput,
  BatchWriteItemCommandOutput,
  DeleteItemCommandInput,
  DeleteItemCommandOutput,
  GetItemCommandInput,
  GetItemCommandOutput,
  PutItemCommandInput,
  PutItemCommandOutput,
  QueryCommandInput,
  QueryCommandOutput,
  UpdateItemCommandInput,
  UpdateItemCommandOutput
} from "@aws-sdk/client-dynamodb";
import { expect } from "chai";
import { GeoDataManagerConfiguration } from "../../src";
import { DynamoDBManager } from "../../src/dynamodb/DynamoDBManager";
import { GeohashRange } from "../../src/model/GeohashRange";
import { captureClient } from "../support/captureClient";
import Long from "long";

const LONDON = { latitude: 51.51, longitude: -0.13 };
const LONDON_GEOHASH = "5221366118452580119";
const PARIS = { latitude: 48.8566, longitude: 2.3522 };

const setup = <Input extends object, Output extends { $metadata: object }>(output: Output) => {
  const inputs: Input[] = [];
  const config = new GeoDataManagerConfiguration(captureClient<Input, Output>(inputs, output), "MyTable");
  return { inputs, config, manager: () => new DynamoDBManager(config) };
};

describe("DynamoDBManager.getPoint", () => {
  it("builds the key from the geohash and the range key, and returns the client output", async () => {
    const output = { $metadata: {}, Item: { rangeKey: { S: "1234" } } };
    const { inputs, manager } = setup<GetItemCommandInput, GetItemCommandOutput>(output);

    const result = await manager().getPoint({
      RangeKeyValue: { S: "1234" },
      GeoPoint: LONDON,
      GetItemInput: { TableName: "Ignored", Key: {}, ProjectionExpression: "country" }
    });

    expect(inputs).to.deep.equal([{
      TableName: "MyTable",
      Key: { hashKey: { N: "52" }, rangeKey: { S: "1234" } },
      ProjectionExpression: "country"
    }]);
    expect(result).to.equal(output);
  });

  it("uses the configured hashKeyLength and attribute names", async () => {
    const { inputs, config, manager } = setup<GetItemCommandInput, GetItemCommandOutput>({ $metadata: {} });
    config.hashKeyLength = 6;
    config.hashKeyAttributeName = "hk";
    config.rangeKeyAttributeName = "rk";

    await manager().getPoint({ RangeKeyValue: { S: "1" }, GeoPoint: LONDON, GetItemInput: { TableName: "", Key: {} } });

    expect(inputs[0].Key).to.deep.equal({ hk: { N: "522136" }, rk: { S: "1" } });
  });
});

describe("DynamoDBManager.putPoint", () => {
  it("creates the Item when the caller gives none", async () => {
    const { inputs, manager } = setup<PutItemCommandInput, PutItemCommandOutput>({ $metadata: {} });

    await manager().putPoint({ RangeKeyValue: { S: "1" }, GeoPoint: LONDON, PutItemInput: {} });

    expect(inputs[0].Item).to.deep.equal({
      hashKey: { N: "52" },
      rangeKey: { S: "1" },
      geohash: { N: LONDON_GEOHASH },
      geoJson: { S: "{\"type\":\"Point\",\"coordinates\":[-0.13,51.51]}" }
    });
  });

  it("writes latitude first and the POINT type when configured", async () => {
    const { inputs, config, manager } = setup<PutItemCommandInput, PutItemCommandOutput>({ $metadata: {} });
    config.longitudeFirst = false;
    config.geoJsonPointType = "POINT";

    await manager().putPoint({ RangeKeyValue: { S: "1" }, GeoPoint: LONDON, PutItemInput: {} });

    expect(inputs[0].Item.geoJson).to.deep.equal({ S: "{\"type\":\"POINT\",\"coordinates\":[51.51,-0.13]}" });
  });

  it("overrides caller values for the managed attributes and the table name", async () => {
    const { inputs, manager } = setup<PutItemCommandInput, PutItemCommandOutput>({ $metadata: {} });

    await manager().putPoint({
      RangeKeyValue: { S: "1" },
      GeoPoint: LONDON,
      PutItemInput: { Item: { hashKey: { N: "0" }, geohash: { N: "0" }, name: { S: "London" } } }
    });

    expect(inputs[0].TableName).to.equal("MyTable");
    expect(inputs[0].Item.hashKey).to.deep.equal({ N: "52" });
    expect(inputs[0].Item.geohash).to.deep.equal({ N: LONDON_GEOHASH });
    expect(inputs[0].Item.name).to.deep.equal({ S: "London" });
  });
});

describe("DynamoDBManager.batchWritePoints", () => {
  it("sends one PutRequest per point under the table name", async () => {
    const { inputs, manager } = setup<BatchWriteItemCommandInput, BatchWriteItemCommandOutput>({ $metadata: {} });

    await manager().batchWritePoints([
      { RangeKeyValue: { S: "london" }, GeoPoint: LONDON, PutItemInput: { Item: { name: { S: "London" } } } },
      { RangeKeyValue: { S: "paris" }, GeoPoint: PARIS, PutItemInput: {} }
    ]);

    expect(inputs).length(1);
    const writes = inputs[0].RequestItems.MyTable;
    expect(writes).length(2);
    expect(writes[0].PutRequest.Item).to.deep.equal({
      name: { S: "London" },
      hashKey: { N: "52" },
      rangeKey: { S: "london" },
      geohash: { N: LONDON_GEOHASH },
      geoJson: { S: "{\"type\":\"Point\",\"coordinates\":[-0.13,51.51]}" }
    });
    expect(writes[1].PutRequest.Item.rangeKey).to.deep.equal({ S: "paris" });
    expect(writes[1].PutRequest.Item.hashKey.N).to.not.equal("52");
  });

  it("forwards only the Item, because BatchWriteItem has no per-item options", async () => {
    const { inputs, manager } = setup<BatchWriteItemCommandInput, BatchWriteItemCommandOutput>({ $metadata: {} });

    await manager().batchWritePoints([{
      RangeKeyValue: { S: "1" },
      GeoPoint: LONDON,
      PutItemInput: { Item: {}, ConditionExpression: "attribute_not_exists(rangeKey)" }
    }]);

    expect(Object.keys(inputs[0].RequestItems.MyTable[0].PutRequest)).to.deep.equal(["Item"]);
  });
});

describe("DynamoDBManager.updatePoint", () => {
  it("sets the table name and the key, and keeps the caller update", async () => {
    const { inputs, manager } = setup<UpdateItemCommandInput, UpdateItemCommandOutput>({ $metadata: {} });

    await manager().updatePoint({
      RangeKeyValue: { S: "1" },
      GeoPoint: LONDON,
      UpdateItemInput: {
        TableName: "Ignored",
        Key: undefined,
        UpdateExpression: "SET country = :c",
        ExpressionAttributeValues: { ":c": { S: "UK" } }
      }
    });

    expect(inputs).to.deep.equal([{
      TableName: "MyTable",
      Key: { hashKey: { N: "52" }, rangeKey: { S: "1" } },
      UpdateExpression: "SET country = :c",
      ExpressionAttributeValues: { ":c": { S: "UK" } }
    }]);
  });

  it("drops AttributeUpdates on the geohash and geoJson attributes", async () => {
    const { inputs, manager } = setup<UpdateItemCommandInput, UpdateItemCommandOutput>({ $metadata: {} });

    await manager().updatePoint({
      RangeKeyValue: { S: "1" },
      GeoPoint: LONDON,
      UpdateItemInput: {
        TableName: "",
        Key: {},
        AttributeUpdates: {
          geohash: { Action: "PUT", Value: { N: "1" } },
          geoJson: { Action: "PUT", Value: { S: "{}" } },
          country: { Action: "PUT", Value: { S: "UK" } }
        }
      }
    });

    expect(Object.keys(inputs[0].AttributeUpdates)).to.deep.equal(["country"]);
  });
});

describe("DynamoDBManager.deletePoint", () => {
  it("forwards the caller options and overrides the table name and key", async () => {
    const { inputs, manager } = setup<DeleteItemCommandInput, DeleteItemCommandOutput>({ $metadata: {} });

    await manager().deletePoint({
      RangeKeyValue: { S: "1" },
      GeoPoint: LONDON,
      DeleteItemInput: {
        TableName: "Ignored",
        Key: { hashKey: { N: "0" } },
        ConditionExpression: "attribute_exists(country)",
        ReturnValues: "ALL_OLD"
      }
    });

    expect(inputs).to.deep.equal([{
      TableName: "MyTable",
      Key: { hashKey: { N: "52" }, rangeKey: { S: "1" } },
      ConditionExpression: "attribute_exists(country)",
      ReturnValues: "ALL_OLD"
    }]);
  });
});

describe("DynamoDBManager.queryGeohash configuration", () => {
  it("uses the configured index, hash key, geohash attribute and consistent read", async () => {
    const { inputs, config, manager } = setup<QueryCommandInput, QueryCommandOutput>({ $metadata: {}, Items: [] });
    config.geohashIndexName = "my-index";
    config.hashKeyAttributeName = "hk";
    config.geohashAttributeName = "gh";
    config.consistentRead = true;

    await manager().queryGeohash(undefined, Long.fromNumber(52), new GeohashRange(10, 20));

    expect(inputs[0].IndexName).to.equal("my-index");
    expect(inputs[0].ConsistentRead).to.equal(true);
    expect(Object.keys(inputs[0].KeyConditions)).to.deep.equal(["hk", "gh"]);
  });

  it("writes a negative hash key as a signed number", async () => {
    const { inputs, manager } = setup<QueryCommandInput, QueryCommandOutput>({ $metadata: {}, Items: [] });

    await manager().queryGeohash(undefined, Long.fromNumber(-85), new GeohashRange(-20, -10));

    expect(inputs[0].KeyConditions.hashKey.AttributeValueList).to.deep.equal([{ N: "-85" }]);
    expect(inputs[0].KeyConditions.geohash.AttributeValueList).to.deep.equal([{ N: "-20" }, { N: "-10" }]);
  });
});
