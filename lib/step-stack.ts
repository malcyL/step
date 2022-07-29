import * as cdk from '@aws-cdk/core';
// import * as sqs from '@aws-cdk/aws-sqs';


import * as lambda from '@aws-cdk/aws-lambda';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';

export class StepStack extends cdk.Stack {
  public Machine: sfn.StateMachine;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'StepQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    // const helloFunction = new lambda.Function(this, 'MyLambdaFunction', {
    //   code: lambda.Code.fromInline(`exports.handler = (event, context, callback) => { callback(null, "Hello World!"); };`),
    //   runtime: lambda.Runtime.NODEJS_14_X,
    //   handler: "index.handler",
    //   // timeout: cdk.Duration.seconds(25)
    // });

    // const stateMachine = new sfn.StateMachine(this, 'MyStateMachine', {
    //   definition: new tasks.LambdaInvoke(this, "MyLambdaTask", {
    //     lambdaFunction: helloFunction
    //   }).next(new sfn.Succeed(this, "GreetedWorld"))
    // });


//     const functionGenerateID = new lambda.Function(this, "GenerateID", {
//       runtime: lambda.Runtime.NODEJS_12_X,
//       handler: "index.handler",
//       code: lambda.Code.fromInline(`
//         const generate = () => Math.random().toString(36).substring(7);

//         exports.handler = async () => ({"value": generate()});
//       `),
//     });

//     const functionReverseID = new lambda.Function(this, "ReverseID", {
//       runtime: lambda.Runtime.NODEJS_12_X,
//       handler: "index.handler",
//       code: lambda.Code.fromInline(`
//         const reverse = (str) => (str === '') ? '' : reverse(str.substr(1)) + str.charAt(0);

//         exports.handler = async (state) => ({"value": reverse(state.value)});
//       `),
//     });

//     const definition = new tasks.LambdaInvoke(this, "Generate ID", {
//       lambdaFunction: functionGenerateID,
//       outputPath: "$.Payload",
//     })
//       .next(
//         new sfn.Wait(this, "Wait 1 Second", {
//           time: sfn.WaitTime.duration(cdk.Duration.seconds(1)),
//         })
//       )
//       .next(
//         new tasks.LambdaInvoke(this, "Reverse ID", {
//           lambdaFunction: functionReverseID,
//           outputPath: "$.Payload",
//         })
//       );

//     this.Machine = new sfn.StateMachine(this, "StateMachine", {
//       definition,
//       timeout: cdk.Duration.minutes(5),
//     });

    // const prefix = `dev-ml-`;

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
         
          callback(null, {
            index,
            step,
            count,
            continue: index < count
          })
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
        exports.handler = async (state) => ({"download": {"index": state.index}, "iterator": {"index": state.index, "step": state.step, "count": state.count}});
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

    // const upload = new lambda.Function(this, "upload", {
    //   runtime: lambda.Runtime.NODEJS_14_X,
    //   handler: "index.handler",
    //   code: lambda.Code.fromInline(`
    //     exports.handler = async (state) => ({});
    //   `),
    // });

    // const callback = new lambda.Function(this, "callback", {
    //   runtime: lambda.Runtime.NODEJS_14_X,
    //   handler: "index.handler",
    //   code: lambda.Code.fromInline(`
    //     exports.handler = async (state) => ({});
    //   `),
    // });

    const iteratorChoice = new sfn.Choice(this, "is count reached")
      .when(sfn.Condition.booleanEquals('$.continue', true), downloadFileTask.next(iteratorTask))
      .when(sfn.Condition.booleanEquals('$.continue', false), archiveTask);

    const definition = readManifestAndIdentifyNumberOfFilesTask
      .next(iteratorTask)
      .next(iteratorChoice);

    // const definition = new tasks.LambdaInvoke(this, "Generate ID", {
    //   lambdaFunction: readManifestAndIdentifyNumberOfFiles,
    //   outputPath: "$.Payload",
    // })
    // .next(
    //   new tasks.LambdaInvoke(this, "Iterator", {
    //     lambdaFunction: iterator,
    //     outputPath: "$.Payload",
    //   })
    // )
    // .next(
    //   new sfn.Choice(this, "is count reached")
    //     .when(sfn.Condition.booleanEquals('$.iterator.continue', 'true'), downloadFileTask.next(next)),
    //     .when(sfn.Condition.booleanEquals('$.iterator.continue', 'fale'), )
    // );

    this.Machine = new sfn.StateMachine(this, "StateMachine", {
      definition,
      timeout: cdk.Duration.minutes(5),
    });
  }
}
