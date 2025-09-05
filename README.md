# WinyamaDroneYard - OpenDroneMap Serverless Automation

DroneYard makes running OpenDroneMap automatically as simple as uploading your images and downloading
the results. DroneYard is a set of automated tooling built on top of AWS Batch that monitors
an S3 bucket for changes, and when it detects the presence of a trigger file, it will launch a
batch job to process your images.

DroneYard borrows inspiration and some code from https://github.com/hobuinc/codm, but makes different
choices about dependencies. In particular, everything is handled by the CDK so it can be built and deployed
with one single command.

This is an adaptation of the original DroneYard to account for deprecated AWS features and updated dependencies  - including code originally from https://github.com/TotallyGatsby/DroneYard. A huge thank you to @TotallyGatsby for their DroneYard solution.

The goal is to make setup and deployment as simple as possible, and rely only on AWS, Docker, and NPM.

![winyama-drone-yard-solution](https://github.com/AlexCarusoFan4/WinyamaDroneYard/assets/62007710/308e04b0-052c-4128-93b9-19bc9e2cc084)

## Usage

### Prerequisites
DroneYard depends on AWS, AWS CDK, NPM, and Docker.

You will need to install the following in your development environment:

- Git
- Node/Node Package Manager
- Docker Desktop
- AWS CLI
- AWS CDK Toolkit

### Configuration
Configure your AWS CLI client with your AWS Account. 

Ideally you will have AWSAdministratorAccess or an equivalent role.

Prior to deployment, make sure Docker is running.

The stack can be configured in `awsconfig.json`, which is where you'll set instance types, whether
to use a GPU, the target memory/CPU requirements, and an email address to subscribe to batch job notifications.

### Deployment
```
git clone https://github.com/AlexCarusoFan4/WinyamaDroneYard.git

cd WinyamaDroneYard

npm install

# If this your first time deploying to this account, you will need to bootstrap your AWS account.

cdk bootstrap

# Otherwise, simply:

cdk deploy --require-approval never

```

Everything is handled by the CDK. It will deploy an S3 bucket, a Lambda function, and an AWS Batch
environment (using the default VPC.) CDK will handle the entire deployment including building
the docker container, uploading it to ECR, setting up all the permissions, and preparing all the
services.

### Usage
After the solution is deployed, you will have an S3 bucket, eg:

```
BucketName: winyamadroneyardstack-dronephotosb1234567-1234567890
```

Create a folder in that bucket and upload all your photos into the bucket. `s3 sync` is useful for
this, but any client will work.

Make sure your folder name doesn't contain any spaces or problematic characters.

You can also optionally upload a settings.yaml file where you set the parameters for the ODM processing job.

If you do not provide one, it will use the provided one in the top level of the S3 bucket by default.

There is support for providing a ground control point (GCP) file (https://docs.opendronemap.org/gcp/) and custom boundary (https://docs.opendronemap.org/arguments/boundary/).

The files must be named gcp-list.txt and boundary.json respectively.

Once all your images are uploaded, upload an empty file named `dispatch` to the folder.

This will start the workflow. When the image processing is complete, a folder called `output` will
be alongside your photos.

### Removal
```
cdk destroy
```

This will retain your S3 bucket. To avoid
charges for S3 you'll want to manually remove anything you uploaded (empty bucket, then delete bucket).
