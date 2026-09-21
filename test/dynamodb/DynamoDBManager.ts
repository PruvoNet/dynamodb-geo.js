import {
  DeleteItemCommandInput,
  DeleteItemCommandOutput,
  PutItemCommandInput,
  PutItemCommandOutput,
  PutRequest,
  QueryCommandInput,
  QueryCommandOutput
} from "@aws-sdk/client-dynamodb";
import { expect } from "chai";
import { GeoDataManagerConfiguration } from "../../src";
import { DynamoDBManager } from "../../src/dynamodb/DynamoDBManager";
import { GeohashRange } from "../../src/model/GeohashRange";
import { captureClient, captureWire } from "../support/captureClient";
import Long from "long";

describe('DynamoDBManager.deletePoint', () => {
  it('calls deleteItem with the correct arguments ', async () => {
    const inputs: DeleteItemCommandInput[] = [];
    const client = captureClient<DeleteItemCommandInput, DeleteItemCommandOutput>(inputs, { $metadata: {} });
    const config = new GeoDataManagerConfiguration(client, 'MyTable');

    const ddb = new DynamoDBManager(config);

    await ddb.deletePoint({
      RangeKeyValue: { S: '1234' },
      GeoPoint: {
        longitude: 50,
        latitude: 1
      }
    });

    expect(inputs).to.deep.equal([{
      TableName: 'MyTable',
      Key: {
        hashKey: { N: '44' },
        rangeKey: { S: '1234' }
      }
    }]);
  });
});

describe('DynamoDBManager.putPoint', () => {
  it('calls putItem with the correct arguments ', async () => {
    const inputs: PutItemCommandInput[] = [];
    const client = captureClient<PutItemCommandInput, PutItemCommandOutput>(inputs, { $metadata: {} });
    const config = new GeoDataManagerConfiguration(client, 'MyTable');

    const ddb = new DynamoDBManager(config);

    // putPoint forwards the whole PutItemInput, so it accepts more than the declared PutRequest shape.
    const putItemInput: PutRequest & { ConditionExpression: string } = {
      Item: { // The primary key, geohash and geojson data is filled in for you
        country: { S: 'UK' }, // Specify attribute values using { type: value } objects, like the DynamoDB API.
        capital: { S: 'London' }
      },
      ConditionExpression: "attribute_not_exists(capital)"
    };

    await ddb.putPoint({
      RangeKeyValue: { S: '1234' }, // Use this to ensure uniqueness of the hash/range pairs.
      GeoPoint: { // An object specifying latitutde and longitude as plain numbers. Used to build the geohash, the hashkey and geojson data
        latitude: 51.51,
        longitude: -0.13
      },
      PutItemInput: putItemInput // Passed through to the underlying DynamoDB.putItem request. TableName is filled in for you.
    });

    expect(inputs).to.deep.equal([{
      TableName: 'MyTable',
      Item: {
        geoJson: { S: "{\"type\":\"Point\",\"coordinates\":[-0.13,51.51]}" },
        geohash: { N: "5221366118452580119" },
        hashKey: { N: "52" },
        rangeKey: { S: "1234" },
        country: { S: 'UK' },
        capital: { S: 'London' }
      },
      ConditionExpression: "attribute_not_exists(capital)"
    }]);
  });
});

describe('DynamoDBManager.queryGeohash', () => {
  it('queries the geohash index using the legacy KeyConditions form', async () => {
    const inputs: QueryCommandInput[] = [];
    const client = captureClient<QueryCommandInput, QueryCommandOutput>(inputs, { $metadata: {}, Items: [] });
    const config = new GeoDataManagerConfiguration(client, 'MyTable');

    const ddb = new DynamoDBManager(config);

    await ddb.queryGeohash(undefined, Long.fromNumber(52), new GeohashRange(10, 20));

    expect(inputs).to.deep.equal([{
      TableName: 'MyTable',
      KeyConditions: {
        hashKey: { ComparisonOperator: 'EQ', AttributeValueList: [{ N: '52' }] },
        geohash: { ComparisonOperator: 'BETWEEN', AttributeValueList: [{ N: '10' }, { N: '20' }] }
      },
      IndexName: 'geohash-index',
      ConsistentRead: false,
      ReturnConsumedCapacity: 'TOTAL',
      ExclusiveStartKey: null
    }]);
  });
});

describe('DynamoDBManager.queryGeohash wire format', () => {
  it('serializes the legacy KeyConditions form onto the Query request', async () => {
    const bodies: unknown[] = [];
    const client = captureWire<QueryCommandOutput>(bodies, { $metadata: {}, Items: [] });
    const config = new GeoDataManagerConfiguration(client, 'MyTable');

    const ddb = new DynamoDBManager(config);

    await ddb.queryGeohash(undefined, Long.fromNumber(52), new GeohashRange(10, 20));

    expect(bodies).to.deep.equal([{
      TableName: 'MyTable',
      IndexName: 'geohash-index',
      ConsistentRead: false,
      KeyConditions: {
        hashKey: { ComparisonOperator: 'EQ', AttributeValueList: [{ N: '52' }] },
        geohash: { ComparisonOperator: 'BETWEEN', AttributeValueList: [{ N: '10' }, { N: '20' }] }
      },
      ReturnConsumedCapacity: 'TOTAL'
    }]);
  });
});

describe('DynamoDBManager.queryGeohash paging', () => {
  it('follows LastEvaluatedKey until a page comes back without one', async () => {
    const firstKey = { hashKey: { N: '52' }, geohash: { N: '15' } };
    const inputs: QueryCommandInput[] = [];
    const client = captureClient<QueryCommandInput, QueryCommandOutput>(
      inputs,
      { $metadata: {}, Items: [], LastEvaluatedKey: firstKey },
      { $metadata: {}, Items: [] }
    );
    const config = new GeoDataManagerConfiguration(client, 'MyTable');

    const ddb = new DynamoDBManager(config);

    const outputs = await ddb.queryGeohash(undefined, Long.fromNumber(52), new GeohashRange(10, 20));

    expect(inputs.map((input) => input.ExclusiveStartKey)).to.deep.equal([null, firstKey]);
    expect(outputs).length(2);
  });

  it('lets the caller QueryInput override the defaults', async () => {
    const inputs: QueryCommandInput[] = [];
    const client = captureClient<QueryCommandInput, QueryCommandOutput>(inputs, { $metadata: {}, Items: [] });
    const config = new GeoDataManagerConfiguration(client, 'MyTable');

    const ddb = new DynamoDBManager(config);

    await ddb.queryGeohash({ TableName: 'Ignored', FilterExpression: 'fakeGeo <> :val' },
      Long.fromNumber(52), new GeohashRange(10, 20));

    expect(inputs[0].FilterExpression).to.equal('fakeGeo <> :val');
    expect(inputs[0].TableName).to.equal('Ignored');
  });
});
