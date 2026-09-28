import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { DeserializeMiddleware, InitializeMiddleware, MetadataBearer } from "@smithy/types";

/**
 * Builds a real DynamoDBClient that records each command input into the given array and answers
 * it locally. The middleware short-circuits at the initialize step, so nothing reaches the network.
 * The last output is reused once the supplied outputs run out.
 */
export const captureClient = <Input extends object, Output extends MetadataBearer>(
  inputs: Input[],
  ...outputs: Output[]
): DynamoDBClient => {
  const client = new DynamoDBClient({ region: "dummy" });
  const capture: InitializeMiddleware<Input, Output> = () => async (args) => {
    inputs.push(args.input);
    const output = outputs.length > 1 ? outputs.shift() : outputs[0];
    return { output, response: undefined };
  };
  client.middlewareStack.add(capture, { step: "initialize", priority: "high" });
  return client;
};

const hasBinaryBody = (request: unknown): request is { body: Uint8Array } =>
  typeof request === "object" && request !== null && "body" in request && request.body instanceof Uint8Array;

/**
 * Builds a real DynamoDBClient that runs the full serializer and records the JSON request bodies it
 * would have sent. The middleware short-circuits at the deserialize step, so nothing is sent.
 */
export const captureWire = <Output extends MetadataBearer>(
  bodies: unknown[],
  output: Output
): DynamoDBClient => {
  const client = new DynamoDBClient({
    region: "eu-west-1",
    credentials: { accessKeyId: "dummy", secretAccessKey: "dummy" }
  });
  const spy: DeserializeMiddleware<object, Output> = () => async (args) => {
    if (!hasBinaryBody(args.request)) {
      throw new Error("expected a serialized request body");
    }
    bodies.push(JSON.parse(new TextDecoder().decode(args.request.body)));
    return { output, response: undefined };
  };
  client.middlewareStack.add(spy, { step: "deserialize", priority: "high" });
  return client;
};
