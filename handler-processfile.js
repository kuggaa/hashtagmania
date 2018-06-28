'use strict';

const rp = require('request-promise');
const moment = require('moment');
const AWS = require('aws-sdk');

const helper = require('./helper');

function getFileDetailsFromTelegram(file_id, uri) {
  const json = {
    file_id: file_id,
  }

  return rp({
    method: 'POST',
    uri: uri+"getFile",
    json: json
  });
}

function LoadFileFromTelegram(file_path, uri) {
  return rp({
    method: 'GET',
    uri: uri+file_path,
    encoding: null,
    resolveWithFullResponse: true
  });
}

function processDetectObjects(bytes){
  console.log("Object type", typeof bytes)
  const rekognition  = new AWS.Rekognition();
  var params = {
    Image: {
      Bytes: bytes
    },
    MinConfidence: 70,
    MaxLabels: 30,
  };
  return rekognition.detectLabels(params).promise();
}


module.exports.main = (event, context, callback) => {
  const env_variables = {
    BOT_NAME: process.env.BOT_NAME,
    BOT_ALIAS: process.env.BOT_ALIAS,
    API_GATEWAY_URL: process.env.API_GATEWAY_URL,
    TELEGRAM_API: process.env.TELEGRAM_API,
    AWS_REGION: process.env.MY_AWS_REGION,
    API_FILE_GATEWAY_URL: process.env.API_FILE_GATEWAY_URL,
    SNS_TOPIC_LEX: process.env.SNS_TOPIC_LEX,
    SNS_RITEKIT:process.env.SNS_RITEKIT,
  }

  console.log("env_variables", env_variables)
  console.log("event", JSON.stringify(event))

  const message = JSON.parse(event.Records[0].Sns.Message);

  console.log("message", message)

  // File
  var file_id = message.file_id;
  console.log("file_id", file_id)

  // Chat ID
  var chatId = message.chatId;
  console.log("chatId", chatId)

  // From
  var userNumber = message.userNumber;
  console.log("userNumber", userNumber)

  // message_id
  var message_id = message.message_id;
  console.log("message_id", message_id)

  var message_text = message.message_text;
  console.log("message_text", message_text);

  // last_name
  var last_name;
  if (message.last_name) {
    last_name = message.last_name;
  } else {
    last_name = message.lastname;
  }
  console.log("last_name", last_name)

  // first_name
  var first_name;
  if (message.first_name) {
    first_name = message.first_name;
  } else {
    first_name = message.firstname;
  }
  console.log("first_name", first_name)

  var response = {
    statusCode: 200,
    body: JSON.stringify({
      message: '',
      input: event,
    }),
  };

  if (chatId) {

    var lex_message = "Hello."
    var keyboard = {}
    var config = {}

    const getFileTelgram = getFileDetailsFromTelegram(file_id, env_variables.API_GATEWAY_URL)
    getFileTelgram.then((data) => {
      console.log("success File Retrieved", data.result)
      console.log("success File Retrieved", data.result.file_path)
      const loadfile = LoadFileFromTelegram(data.result.file_path, env_variables.API_FILE_GATEWAY_URL);
      return loadfile;
    }).then((bytes) => {
      console.log("Retrieved File - ", bytes)
      const processdetectobjects = processDetectObjects(bytes.body)
      return processdetectobjects;
    }).then((data) => {
      const detectLabels = data;
      console.log("message_data:", JSON.stringify(data))
      var config = {"file_id": file_id, "chatId":chatId, "detectLabels":detectLabels, "message_id":message_id, "userNumber": userNumber, "message_text":message_text,"lastname": last_name, "firstname": first_name}
      return helper.publish_sns(config, env_variables.SNS_RITEKIT);
    }).then((body) => {
      lex_message = "Retrieved File Succesfully. Analysing picture and creating hashtag.....";
      console.log("message_data:", JSON.stringify(body))
      return helper.sendMessageToTelegram(chatId, message_id, lex_message, env_variables.API_GATEWAY_URL, null);
    }).then((body) => {
      console.log("success message send", body)
      response.message = "success message send"
      callback(null, response);
    }).catch((err) => {
      response.statusCode =  400
      response.message = "Error"
      console.log("error", err)
      callback(err, "error");
    });

  } else {
    response.statusCode = 400
    response.message = "No chatId"
    callback(response, "failed");
  }

  callback(null, response);

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};
