import * as cdk from '@aws-cdk/core';
// import * as sqs from '@aws-cdk/aws-sqs';


import * as lambda from '@aws-cdk/aws-lambda';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';

export class StepStack extends cdk.Stack {
  public Machine: sfn.StateMachine;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const readManifestAndIdentifyNumberOfFiles = new lambda.Function(this, `IdentifyNumberOfFiles`, {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async () => ({"iterator": {"count": 16, "index": 0, "step": 1}});
      `),
    });
    const readManifestAndIdentifyNumberOfFilesTask = new tasks.LambdaInvoke(this, "identifyNumberOfFilesTask", {
      lambdaFunction: readManifestAndIdentifyNumberOfFiles,
      outputPath: "$.Payload",
    });

    const iterator = new lambda.Function(this, "Iterator", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = function iterator (event, context, callback) {
          console.log(\`Event: \${JSON.stringify(event)}\`);
          let index = event.iterator.index
          let step = event.iterator.step
          let count = event.iterator.count
         
          index = index + step
         
          callback(null, { iterator: {
            index,
            step,
            count,
            continue: index < count
          }})
        }
      `),
    });
    const iteratorTask = new tasks.LambdaInvoke(this, "IteratorTask", {
      lambdaFunction: iterator,
      outputPath: "$.Payload",
    });

    const downloadFile = new lambda.Function(this, "downloadFile", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (state) => ({"downloaded": {"index": state.iterator.index}, "iterator": state.iterator});
      `),
    });
    const downloadFileTask = new tasks.LambdaInvoke(this, "downloadFileTask", {
      lambdaFunction: downloadFile,
      outputPath: "$.Payload",
    });


    const archive = new lambda.Function(this, "archive", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (state) => ({});
      `),
    });
    const archiveTask = new tasks.LambdaInvoke(this, "archiveTask", {
      lambdaFunction: archive,
      outputPath: "$.Payload",
    });

    const upload = new lambda.Function(this, "upload", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (state) => ({});
      `),
    });
    const uploadTask = new tasks.LambdaInvoke(this, "uploadTask", {
      lambdaFunction: upload,
      outputPath: "$.Payload",
    });

    const callback = new lambda.Function(this, "callback", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (state) => ({});
      `),
    });
    const callbackTask = new tasks.LambdaInvoke(this, "callbackTask", {
      lambdaFunction: callback,
      outputPath: "$.Payload",
    });

    const iteratorChoice = new sfn.Choice(this, "is count reached")
      .when(sfn.Condition.booleanEquals('$.iterator.continue', true), downloadFileTask.next(iteratorTask))
      .when(sfn.Condition.booleanEquals('$.iterator.continue', false), archiveTask.next(uploadTask).next(callbackTask));

    const definition = readManifestAndIdentifyNumberOfFilesTask
      .next(iteratorTask)
      .next(iteratorChoice);

    this.Machine = new sfn.StateMachine(this, "StateMachine", {
      definition,
      timeout: cdk.Duration.minutes(5),
    });
  }
}
