import {
  AttributeValue,
  BatchWriteItemCommandOutput,
  DeleteItemCommandInput,
  DeleteItemCommandOutput,
  GetItemCommandInput,
  GetItemCommandOutput,
  PutItemCommandOutput,
  PutRequest,
  QueryCommandInput,
  QueryCommandOutput,
  UpdateItemCommandInput,
  UpdateItemCommandOutput
} from "@aws-sdk/client-dynamodb";

export type ItemList = Record<string, AttributeValue>[];

export interface BatchWritePointOutput extends BatchWriteItemCommandOutput {
}

export interface DeletePointInput {
  RangeKeyValue: AttributeValue;
  GeoPoint: GeoPoint;
  DeleteItemInput?: DeleteItemCommandInput
}
export interface DeletePointOutput extends DeleteItemCommandOutput {
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}
export interface GeoQueryInput {
  QueryInput?: Partial<QueryCommandInput>;
}
export interface GeoQueryOutput extends QueryCommandOutput {
}
export interface GetPointInput {
  RangeKeyValue: AttributeValue;
  GeoPoint: GeoPoint;
  GetItemInput: GetItemCommandInput;
}
export interface GetPointOutput extends GetItemCommandOutput {
}
export interface PutPointInput {
  RangeKeyValue: AttributeValue;
  GeoPoint: GeoPoint;
  PutItemInput: PutRequest;
}
export interface PutPointOutput extends PutItemCommandOutput {
}
export interface QueryRadiusInput extends GeoQueryInput {
  RadiusInMeter: number;
  CenterPoint: GeoPoint;
}
export interface QueryRadiusOutput extends GeoQueryOutput {
}
export interface QueryRectangleInput extends GeoQueryInput {
  MinPoint: GeoPoint;
  MaxPoint: GeoPoint;
}
export interface QueryRectangleOutput extends GeoQueryOutput {
}
export interface UpdatePointInput {
  RangeKeyValue: AttributeValue;
  GeoPoint: GeoPoint;
  UpdateItemInput: UpdateItemCommandInput;
}
export interface UpdatePointOutput extends UpdateItemCommandOutput {
}
