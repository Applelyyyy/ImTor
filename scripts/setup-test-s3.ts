import { config } from "dotenv";
import {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
config({ path: ".env.s3-test", override: true });
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.S3_ENDPOINT!).hostname,
  )
)
  throw new Error("Local test storage only");
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
try {
  await s3.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
} catch (e) {
  if (
    !(e instanceof Error) ||
    !["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(e.name)
  )
    throw e;
}
await s3.send(
  new PutBucketPolicyCommand({
    Bucket: process.env.S3_BUCKET,
    Policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${process.env.S3_BUCKET}/approved/*`],
        },
      ],
    }),
  }),
);
await s3.send(
  new PutBucketCorsCommand({
    Bucket: process.env.S3_BUCKET,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ["http://localhost:3100", "http://127.0.0.1:3100"],
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedHeaders: ["content-type", "content-length", "x-amz-*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 300,
        },
      ],
    },
  }),
);
console.log("Local S3 bucket configured; only approved/ publicly readable");
