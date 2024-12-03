const AWS = require('aws-sdk');

const sns = new AWS.SNS();

function toTitleCase(str) {
    if (str === null) {
      return null
    }
    return str.replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}

exports.handler = function (event, context) {
  console.log('Event received:');
  console.log(event);

  var params = {
    Message: `Job Source: ${event.detail.parameters.bucket}/${event.detail.parameters.key}`,
    Subject: `Job ${toTitleCase(event.detail.status)}`,
    TopicArn: process.env.SNS_ARN
  };

  sns.publish(params, context.done);
};
