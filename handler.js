'use strict';

const rp      = require('request-promise');
const AWS     = require('aws-sdk');
const helper  = require('./helper');

function parseCommand(message) {
  const tokens = message.split(' ');
  if (!tokens[0].match(/^\//)) {
    return null;
  }
  const command = [];
  const cmd = tokens.shift();
  const match = cmd.match(/\/(\w*)/);
  if (match.length > 0) {
    command[match[1]] = tokens;
  }
  return command;
}

function processCommands(first_name, message) {
  if (message) {
    const commandArguments = parseCommand(message.trim());
    console.log("commandArguments", commandArguments)
    if (commandArguments === null) {
      return message
    }

    const commandKeys = Object.keys(commandArguments);

    if (commandKeys.length === 0 ) {
      return message
    } else {
      const command = commandKeys[0];
      if(command == "help") {
        return "Upload a picture and add a caption to your picture. I will return hashtag relating to your picture.";
      } else if(command == "start") {
        return "Welcome "+first_name+" to hashtagmania bot, I'm a bot and I'm using Amazon object recognition service to analayse your images and generate hashtags for you. Try it by uploading a picture."
      } else {
        return message
      }
    }

  }
}

module.exports.mainhandler = (event, context, callback) => {

  const env_variables = {
    BOT_NAME            : process.env.BOT_NAME,
    BOT_ALIAS           : process.env.BOT_ALIAS,
    API_GATEWAY_URL     : process.env.API_GATEWAY_URL,
    TELEGRAM_API        : process.env.TELEGRAM_API,
    AWS_REGION          : process.env.MY_AWS_REGION,
    DYNAMODB_TABLE      : process.env.DYNAMODB_TABLE,
    API_FILE_GATEWAY_URL: process.env.API_FILE_GATEWAY_URL,
    SNS_TOPIC_LEX       : process.env.SNS_TOPIC_LEX,
    SNS_TOPIC_FILE      : process.env.SNS_TOPIC_FILE,
  }

  console.log("env_variables", env_variables)
  console.log("event", JSON.stringify(event))

  // Message
  var message;
  if (event.body.channel_post && event.body.channel_post.text) {
    message = event.body.channel_post.text;
  } else if (event.body.message && event.body.message.text) {
    message = event.body.message.text;
  }
  console.log("message", message)


  // caption
  var caption;
  if (event.body.message && event.body.message.caption) {
    caption = event.body.message.caption;
  }
  console.log("caption", caption);

  // first_name
  var first_name;
  if (event.body.message && event.body.message.from && event.body.message.from.first_name) {
    first_name = event.body.message.from.first_name;
  }
  console.log("first_name", first_name)


  message = processCommands(first_name, message);

  // File
  var file_id;
  if (event.body.message.document && event.body.message.document.file_id) {
      file_id = event.body.message.document.file_id;
  } else if (event.body.message.photo && event.body.message.photo instanceof Array) {
      const numberphotos = event.body.message.photo.length-1;
      console.log("numberphotos", numberphotos);
      file_id = event.body.message.photo[numberphotos].file_id;
  }
  console.log("file_id", file_id)

  // Chat ID
  var chatId;
  if (event.body.message && event.body.message.chat && event.body.message.chat.id) {
    chatId = event.body.message.chat.id;
  } else if (event.body.channel_post && event.body.channel_post.chat && event.body.channel_post.chat.id) {
    chatId = event.body.channel_post.chat.id;
  }
  console.log("chatId", chatId)

  // From
  var userNumber;
  if (event.body.message && event.body.message.from && event.body.message.from.id) {
    userNumber = event.body.message.from.id.toString();
  } else if (event.body.channel_post && event.body.channel_post.from && event.body.channel_post.from.id) {
    userNumber = event.body.channel_post.from.id.toString();
  }
  console.log("userNumber", userNumber)

  // message_id
  var message_id;
  if (event.body.message && event.body.message.message_id) {
    message_id = event.body.message.message_id.toString();
  }
  console.log("message_id", message_id)


  // last_name
  var last_name;
  if (event.body.message && event.body.message.from && event.body.message.from.last_name) {
    last_name = event.body.message.from.last_name;
  }
  console.log("last_name", last_name)

  var response = {
    statusCode: 200,
    body: JSON.stringify({
      message: '',
      input: event,
    }),
  };

    if (chatId) {

      if(file_id){
        var config = {"file_id": file_id, "chatId":chatId, "message_id":message_id, "userNumber": userNumber, "message_text":caption,"lastname": last_name, "firstname": first_name}
        const publishsns = helper.publish_sns(config, env_variables.SNS_TOPIC_FILE);
        publishsns.then((data) => {
          console.log("published sns", data)
          return helper.sendChatActionToTelegram(chatId, "typing", env_variables.API_GATEWAY_URL);
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
        const replytotelegram = helper.sendMessageToTelegram(chatId, message_id, message, env_variables.API_GATEWAY_URL, null);
        replytotelegram.then((data) => {
          console.log("success message send", data);
          response.message = "success message send"
          callback(null, response);
        }).catch((err) => {
          response.statusCode =  400
          response.message = "Error"
          console.log("error", err)
          callback(err, "error");
        });
      }

    } else {
      response.statusCode = 400
      response.message = "No chatId"
      callback(response, "failed");
    }

  callback(null, response);

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};
