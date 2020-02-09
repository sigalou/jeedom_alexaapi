/*jshint esversion: 6,node: true,-W041: false */
const express = require('express');
const fs = require('fs');
const Alexa = require('./lib/alexa-remote.js');

let alexa;
//var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest  ;
const request = require('request');

const amazonserver = process.argv[3];
const alexaserver = process.argv[4];
const IPJeedom = process.argv[2];
const ClePlugin = process.argv[5];
const logLevel = process.argv[6];
//if (process.argv[7] == 1) useWsMqtt=true; else useWsMqtt=false; abandonné
useWsMqtt=true;
//const debug=1; //mettre 1 pour debug
// Références :
// https://openclassrooms.com/fr/courses/1173401-les-closures-en-javascript

/* Configuration */
const config = {
	cookieLocation: __dirname + '/data/alexa-cookie.json',
	cookieRefreshInterval: 7 * 24 * 60 * 1000,
	logger: consoleSigalou,
	alexaServiceHost: alexaserver,
    useWsMqtt: useWsMqtt, 
	listeningPort: 3456
};

var dernierStartServeur=0;

// Par sécurité pour détecter un éventuel souci :
if (!amazonserver) config.logger('Alexa-Config: *********************amazonserver NON DEFINI*********************');
if (!alexaserver) config.logger('Alexa-Config: *********************alexaserver NON DEFINI*********************');


// Speed up calls to hasOwnProperty - Pour le test function isEmpty(obj)
var hasOwnProperty = Object.prototype.hasOwnProperty;
function isEmpty(obj) {

    // null and undefined are "empty"
    if (obj == null) return true;

    // Assume if it has a length property with a non-zero value
    // that that property is correct.
    if (obj.length > 0)    return false;
    if (obj.length === 0)  return true;

    // If it isn't an object at this point
    // it is empty, but it can't be anything *but* empty
    // Is it empty?  Depends on your application.
    if (typeof obj !== "object") return true;

    // Otherwise, does it have any properties of its own?
    // Note that this doesn't handle
    // toString and valueOf enumeration bugs in IE < 9
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }

    return true;
}


	// arguments[0]	c'est le texte
	// arguments[1]	c'est le niveau de log ou un array
	
	//niveaudeLog=5 c'est tout
	//niveaudeLog=2 c'est reduit
	

function consoleSigalou(text, level='') {
	var today = new Date();

	// 100=DEBUG
	// 200=INFO
	// 300=WARNING
	// 400=ERROR
	//1000=AUCUN
	
	try {
	switch (level) {
	  case "ERROR":	
			niveauLevel=400;
			break;
	  case "WARNING":	
			niveauLevel=300;
			break;		
	  case "INFO":	
			niveauLevel=200;
			break;		
	  case "DEBUG":	
			niveauLevel=100;
			break;	
	  default:
			niveauLevel=400; //pour trouver ce qui n'a pas été affecté à un niveau
			break;
	  
	}
		if (logLevel<=niveauLevel)
			console.log("[" + today.toLocaleString() + "]["+ level+"] : " + arguments[0].concat(Array.prototype.slice.call(arguments, 2)));
	} catch (e) {
		console.log(arguments[0]);
	}
	

}


/* Routing */
const app = express();
let server = null;
/* Objet contenant les commandes pour appeler via chaine */
var CommandAlexa = {};

/* Apply callback on every cluster's membre (for multiroom device) */
function forEachDevices(nameOrSerial, callback) {
	
	var device = alexa.find(nameOrSerial);
	if (device === undefined)
		return;

	if (device.clusterMembers.length == 0)
		callback(device.serialNumber);

	for (var i in device.clusterMembers) {
		if (device.clusterMembers.hasOwnProperty(i)) {
			// We are sure that obj[key] belongs to the object and was not inherited.
			callback(device.clusterMembers[i]);
		}
	}
}


function LancementCommande(commande, req) 
{
	config.logger('Alexa-API:    Lancement /'+commande, "INFO");

}

CommandAlexa.query = function(req,res){
	
	res.type('json');
	
	//config.logger('Alexa-API:    Lancement /query');
	config.logger('VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
	config.logger('VVVVVVVVVVVVVVVVVVVVVVVV--- R E Q U E T E U R ---VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
	config.logger('VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
	config.logger('Send Request with '+decodeURIComponent(req.query.query));
	config.logger('and data='+decodeURIComponent(req.query.data));
	config.logger('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');

	alexa.httpsGetCall(decodeURIComponent(req.query.query), function(err) {
		if (err)
			return res.status(500).json(error(500, req.route.path, 'Requeteur', err));
		res.status(200).json({});
	}, decodeURIComponent(req.query.data));
	
	
}

/***** checkAuth *****
  URL: /checkAuth

  Return the status of the Auth
  [{
    auth - binary - authentified or not
  }]

*/
CommandAlexa.checkAuth = function(req,res){
	
	res.type('json');
	
config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');	

	alexa.checkAuthentication(function(auth) {
		res.status(200).json({
			authenticated: auth
		});
	});
	
}


/**** Alexa.Speak *****
  URL: /speak?device=?&text=?
    device - String - name of the device
    text - String - Text to speech
*/
CommandAlexa.Speak = function(req,res){
	
	res.type('json');
	
	config.logger('Alexa-API:    Lancement /Speak avec paramètres -> device:' + req.query.device+'/text:' + req.query.text +'/ssml:' + req.query.ssml  +'/jingle:' + req.query.jingle +'/volume:'+ req.query.volume +'/lastvolume:' + req.query.lastvolume, 'INFO');

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.Speak', 'Missing parameter "device"'));
	if ('text' in req.query === false)	 return res.status(500).json(error(500, req.route.path, 'Alexa.Speak', 'Missing parameter "text"'));
	
	var SpeakouAnnouncement = 'speak';
	if (('jingle' in req.query === true) && (req.query.jingle == true)) SpeakouAnnouncement = 'announcement';
	if (('ssml' in req.query === true) && (req.query.ssml == true)) SpeakouAnnouncement = 'ssml';

	let Commands = [];
	var test = ('volume' in req.query === true) && (req.query.volume != "");
	if (test) 											Commands.push({command: 'volume', value: req.query.volume});
														Commands.push({command: SpeakouAnnouncement, value: req.query.text});
	if (('lastvolume' in req.query === true) && test) 	Commands.push({command: 'volume', value: req.query.lastvolume});
	
	boucleSurSerials_sendMultiSequenceCommand(req, Commands);

	res.status(200).json({value: "Send"});	//ne teste pas le résultat//supprimé 16/11/2019
}

/**** Alexa.Announcement *****
  URL: /announcement?device=?&text=?
    device - String - name of the device
    text - String - Text to speech
*/
CommandAlexa.Announcement = function(req,res){
	
	res.type('json');
	
	config.logger('Alexa-API:    Lancement /Announcement avec paramètres -> device:' + req.query.device+'/text:' + req.query.text +'/volume:' + req.query.volume +'/lastvolume:' + req.query.lastvolume);

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.Announcement', 'Missing parameter "device"'));
	if ('text' in req.query === false)	 return res.status(500).json(error(500, req.route.path, 'Alexa.Announcement', 'Missing parameter "text"'));


	let Commands = [];
	var test = ('volume' in req.query === true) && (req.query.volume != "");
	if (test) 											Commands.push({command: 'volume', value: req.query.volume});
														Commands.push({command: 'announcement', value: req.query.text});
	if (('lastvolume' in req.query === true) && test) 	Commands.push({command: 'volume', value: req.query.lastvolume});
	
	boucleSurSerials_sendMultiSequenceCommand(req, Commands);
	

	//boucleSurSerials_sendMultiSequenceCommand(req, 'announcement');
		
		// pour ne pas boucler mais ne fonctionne pas sur les groupes
		/*
		alexa.sendSequenceCommand(req.query.device, 'announcement', req.query.text,
		//alexa.sendCommand('G0911W079304113M', 'announcement', 'coucou',
				function(testErreur){
						if (testErreur) 
						{traiteErreur(testErreur);
						res.status(500).json(error(500, req.route, 'Alexa.DeviceControls.Announcement', testErreur.message));
						}
						else
						res.status(200).json({value: "OK"});	//ne teste pas le résultat
					}
			);
	*/
	
	res.status(200).json({value: "Send2"});	//ne teste pas le résultat//supprimé 16/11/2019
}





/**** Alexa.Radio *****
  URL: /radio?device=?&text=?
    device - String - name of the device
    text - String - Text to speech
*/
CommandAlexa.Radio = function(req,res){

	res.type('json');

	if ('device' in req.query === false)  return res.status(500).json(error(500, req.route.path, 'Alexa.Radio', 'Missing parameter "device"'));
	if ('station' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.Radio', 'Missing parameter "station"'));
	
	config.logger('Alexa-API:    Lancement /Radio avec paramètres -> device: ' + req.query.device+' & station: ' + req.query.station);

	// Suppression de la boucle des serial, en effet, si on envoi sur un groupe, la radio fonctionne en multiroom
	//boucleSurSerials_setTunein(req);

			alexa.setTunein(req.query.device, req.query.station, 
				function(testErreur){
						if (testErreur) 
						{traiteErreur(testErreur, 'radio', req.query);
						res.status(500).json(error(500, req.route, 'Alexa.DeviceControls.Radio', testErreur.message));
						}
						else
						res.status(200).json({value: "OK"});	//ne teste pas le résultat
					}
			);

}


/***** Alexa.Volume *****
  URL: /volume?device=?&value=?
    device - String - name of the device
    value - Integer - Determine the volume level between 0 to 100 (0 is mute and 100 is max)
*/
CommandAlexa.Volume = function(req,res){
	
	res.type('json');

	//Quand Volume est lancé par une autre fonction, la valeur du volume n'est pas value mais volume
	if ('volume' in req.query) req.query.value=req.query.volume
	
	config.logger('Alexa-API: Lancement /Volume avec paramètres -> device: ' + req.query.device+' & value: ' + req.query.value, "INFO");

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.Volume', 'Missing parameter "device"'));
	if ('value' in req.query === false)	 return res.status(500).json(error(500, req.route.path, 'Alexa.Volume', 'Missing parameter "value"'));
/*
for (var i = 0; i < 9; i++) {
	alexa.sendSequenceCommand(req.query.device, 'volume', req.query.value, function(testErreur){if (testErreur) {traiteErreur(testErreur, 'volume', req.query);}});
	}
*/
	alexa.sendSequenceCommand(req.query.device, 'volume', req.query.value, 
		function(testErreur){
				if (testErreur) 
				{traiteErreur(testErreur, 'volume', req.query);
				res.status(500).json(error(500, req.route, 'Alexa.DeviceControls.Volume', testErreur.message));
				}
				else
				res.status(200).json({value: "OK"});	//ne teste pas le résultat
			}
	);	
		
}
/***** Alexa.playList *****
  URL: /volume?device=?&value=?
    device - String - name of the device
    value - Integer - Determine the volume level between 0 to 100 (0 is mute and 100 is max)
*/
CommandAlexa.playList = function(req,res){
	
	res.type('json');

	config.logger('Alexa-API:    Lancement /playList avec paramètres -> device: ' + req.query.device+' & playlist: ' + req.query.playlist);

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.playList', 'Missing parameter "device"'));
	if ('playlist' in req.query === false)	 return res.status(500).json(error(500, req.route.path, 'Alexa.playList', 'Missing parameter "playlist"'));

			
			alexa.playList(req.query.device, req.query.playlist, 
				function(testErreur){
						if (testErreur){ 
						traiteErreur(testErreur, 'playlist', req.query);
						res.status(500).json(error(500, req.route, 'Alexa.DeviceControls.playList', testErreur.message));
						}
						else
						res.status(200).json({value: "OK"});	//ne teste pas le résultat
					}
			);
			
		
}

/***** CommandAlexa.playMusicTrack *****
*/
CommandAlexa.playMusicTrack = function(req,res){
	
	res.type('json');

	config.logger('Alexa-API:    Lancement /playMusicTrack avec paramètres -> device: ' + req.query.device+' & trackId: ' + req.query.trackId);

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.playMusicTrack', 'Missing parameter "device"'));
	if ('trackId' in req.query === false)	 return res.status(500).json(error(500, req.route.path, 'Alexa.playMusicTrack', 'Missing parameter "trackId"'));

			
			alexa.playMusicTrack(req.query.device, req.query.trackId, 
				function(testErreur){
						if (testErreur) {
						traiteErreur(testErreur, 'playmusictrack', req.query);
						res.status(500).json(error(500, req.route, 'Alexa.DeviceControls.playMusicTrack', testErreur.message));
						}
						else
						res.status(200).json({value: "OK"});	//ne teste pas le résultat
					}
			);
			
		
}
/***** Alexa.Command *****
  URL: /command?device=?&command=?
    device - String - name of the device
    command - String - command : pause|play|next|prev|fwd|rwd|shuffle|repeat
*/
CommandAlexa.Command = function(req,res){
	res.type('json');

	config.logger('Alexa-API:    Lancement /Command avec paramètres -> device: ' + req.query.device+' & command: ' + req.query.command);

	if ('device' in req.query === false)  return res.status(500).json(error(500, req.route.path, 'Alexa.Command', 'Missing parameter "device"'));
	if ('command' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.Command', 'Missing parameter "command"'));
	
	// suppression de la boucle des serial
	//boucleSurSerials_sendCommand(req);
	config.logger('Alexa-API:    *******************************************');

			alexa.sendCommand(req.query.device, req.query.command, req.query.value,
				function(testErreur){
						if (testErreur) {
						traiteErreur(testErreur, 'command', req.query);;
						res.status(500).json(error(500, req.route, 'Alexa.DeviceControls.Command', testErreur.message));
						}
					}
			);
		
			
res.status(200).json({value: "Send"});	//ne teste pas le résultat
setTimeout(refreshPlayer.bind(null, req.query.device), 3000); // Dans 3s, actualiser le player
	
}


function refreshPlayer(deviceSerialNumber) {
	//config.logger('Alexa-API:    *******************************************7 Lancement /Command avec paramètres -> device: ');

	var action="REFRESH";
	httpPost('refreshPlayer', {
                        deviceSerialNumber: deviceSerialNumber,
						audioPlayerState: action
                    });	
	//config.logger('Alexa-API:    *******************************************8 Lancement /Command avec paramètres -> device: ');
}



/***** Alexa.SmarthomeCommand *****

*/
CommandAlexa.SmarthomeCommand = function(req,res){
	
		res.type('json');

	config.logger('Alexa-API:    Lancement /SmarthomeCommand avec paramètres -> device: ' + req.query.device+' & command: ' + req.query.command);

	if ('device' in req.query === false)  return res.status(500).json(error(500, req.route.path, 'Alexa.SmarthomeCommand', 'Missing parameter "device"'));
	if ('command' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.SmarthomeCommand', 'Missing parameter "command"'));

						parameters = {};
					
						parameters.action = 'turnOn'; // Même opération mais d'une autre manière
						parameters.action = 'turnOff'; // Même opération mais d'une autre manière
						parameters.action = req.query.command; 
						if (req.query.entityType=='')
							req.query.entityType="APPLIANCE";
							
    //executeSmarthomeDeviceAction(entityIds, parameters, entityType, callback) {
		
    alexa.executeSmarthomeDeviceAction(req.query.device, parameters, req.query.entityType,
				function(testErreur){
					if (testErreur) traiteErreur(testErreur);
				}
			);
		var powerState="0";
		if (parameters.action == 'turnOn') powerState="1";
			
	  	var toReturn = [];		
		toReturn.push({
					'device': req.query.device,
					'command': parameters.action,
					'powerState': powerState
				});
		res.status(200).json(toReturn);		

			
	//res.status(200).json({value: "Send"});	//ne teste pas le résultat

}

CommandAlexa.querySmarthomeDevices = function(req,res){
	
	//-----------------------------------------------------------------------------------
	// NE FONCTIONNE PAS IL MANQUE applicanceIds QUI EST DIFF2RENT DE entityIds
	//-----------------------------------------------------------------------------------
	
	
		res.type('json');

	config.logger('Alexa-API:    Lancement /SmarthomeCommand avec paramètres -> device: ' + req.query.device);

	if ('device' in req.query === false)  return res.status(500).json(error(500, req.route.path, 'Alexa.SmarthomeCommand', 'Missing parameter "device"'));


						if (req.query.entityType!='')
							entityType=req.query.entityType;
						else
							entityType="APPLIANCE";
							
    //executeSmarthomeDeviceAction(entityIds, parameters, entityType, callback) {
	config.logger('Alexa-API:    Lancement /SmarthomeCommand avec paramètres -> req.query.entityType: ' + req.query.entityType);
		

		/*
    alexa.querySmarthomeDevices(req.query.device, entityType,
				function(devices){

					

			config.logger('Alexa-API: trouvé :'+devices);
			//valeurvolume=devices["volume"];
			res.status(200).json({		value: devices	});



					
					//if (testErreur) traiteErreur(testErreur);
				}
			);
	
*/
	alexa.querySmarthomeDevices2(req.query.device, entityType,
		function(deviceStates){
		//config.logger('>'+JSON.stringify(deviceStates),'DEBUG');
		//config.logger('0>'+JSON.stringify(deviceStates[0]),'DEBUG');
		//config.logger('>entity>'+JSON.stringify(deviceStates."0"),'DEBUG');
		var toReturn = [];
		try {
			//config.logger('>deviceState>>'+JSON.stringify(deviceStates[0]),'DEBUG');
			//config.logger('>entity>>'+JSON.stringify(deviceStates[0].entity),'DEBUG');
			config.logger('queryState:entityId>'+JSON.stringify(deviceStates[0].entity.entityId),'DEBUG');
			//config.logger('>entityType>>'+JSON.stringify(deviceStates[0].entity.entityType),'DEBUG');
			capabilityStates=JSON.parse(deviceStates[0].capabilityStates[0]);
			//config.logger('>>>capabilityStates>>'+JSON.stringify(capabilityStates),'DEBUG');

//for (value in capabilityStates) {
  //config.logger(value+"<=>"+capabilityStates[value],'DEBUG');
//}
				toReturn.push({
					'entityType': entityType,
					'applicanceId': req.query.device,
					'name': capabilityStates['name'],
					'value': capabilityStates['value']

				});
			config.logger('queryState:name>'+capabilityStates['name'],'DEBUG');
			config.logger('queryState:>value>'+capabilityStates['value'],'DEBUG');

		}
		catch(error) {
				config.logger('deviceStates.entity.entityId>NON trouvé sur '+entityType+"/"+req.query.device,'DEBUG');
		}

			
/*
		for (var deviceState in deviceStates[0]) {
			//config.logger('>deviceState>>'+JSON.stringify(deviceState),'DEBUG');
			for (var entity in deviceState) {
			config.logger('>>>>'+JSON.stringify(entity),'DEBUG');
			config.logger('>>>>>'+JSON.stringify(deviceState.entity),'DEBUG');
				//var device = notifications[serial];
				toReturn.push({
					'entityType': entityType,
					'applicanceId': req.query.device,
					'deviceState': deviceState.capabilityStates,
					'entityType2': entityType

				});
			}
			
		}*/
		res.status(200).json(toReturn);
	});













	
	//config.logger("fini");
	  	
			
			
			//config.logger('Alexa*********************************************************************');

			
	//res.status(200).json({value: "Send"});	//ne teste pas le résultat

}

// Les boucles qui lancent les commandes sur chaques device d'un multiroom
function boucleSurSerials_setTunein (req, callback) {
		resultatEnvoi=  forEachDevices(req.query.device, (serial) => {
			alexa.setTunein(serial, req.query.station, 
				function(testErreur){
					if (testErreur) traiteErreur(testErreur);
				}
			);
		});
}

function boucleSurSerials_sendMultiSequenceCommand (req, actions, callback) {
		
	
		if (!!req.query.text) req.query.value=req.query.text; // dans l'hypothèse où la valeur est dans un champ text

/*
Version initiale qui donne le résultat

  alexa.sendSequenceCommand(req.query.device, 'speak', req.query.text, function(err)
  {
    if (err)
      return res.status(500).json(error(500, req.route.path, 'Alexa.Speak', err));
    res.status(200).json({});
  });
  

	let Commands = [];
	var test = ('volume' in req.query === true) && (req.query.volume != "");
	if (test) 											Commands.push({command: 'volume', value: req.query.volume});
														Commands.push({command: SpeakouAnnouncement, value: req.query.text});
	if (('lastvolume' in req.query === true) && test) 	Commands.push({command: 'volume', value: req.query.lastvolume});
*/

		forEachDevices(req.query.device, (serial) => {
			alexa.sendMultiSequenceCommand(serial, actions, "SerialNode",
				function(testErreur){
					if (testErreur) {
						traiteErreur(testErreur, actions, req.query);
					}
				}
			);
		});	
}


function boucleSurSerials_sendCommand (req, callback) {
	//pas sur qu'on l'utilise encore !!!!!!!!!!!!
		resultatEnvoi=  forEachDevices(req.query.device, (serial) => {
			
			 alexa.sendCommand(serial, req.query.command, 
				function(testErreur){
					if (testErreur) traiteErreur(testErreur);
					config.logger('Alexa-API:    >>>>>>>>>>>>>>>>>>>>>>>on est la 8888888888>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> OK Refresh playinfo ');
				}	
			);
			
		//setTimeout(function() {  RefreshApresCommand (serial); }, 5000);
			
		});
}
/*
function RefreshApresCommand (serial) {
	
			config.logger('Alexa-API:    >>>>>>>>>>>>>>>>>>>>>>>on est la>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> OK Refresh playinfo ');
					
					
				Appel_getPlayerInfo(serial, function(retourAmazon) {
				fichierjson = __dirname + '/data/playerInfo-'+serial+'.json';
				fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
				{
			config.logger('Alexa-API:    >>>>>>>>>>>>>>>>>>>>>>>on est la 5555>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> OK Refresh playinfo ');
				
				//if (err) return res.sendStatus(500)
						});
			config.logger('Alexa-API:    >>>>>>>>>>>>>>>>>>>>>>>on est la 66666>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> OK Refresh playinfo ');
				//res.status(200).json(retourAmazon);
				});		
}
*/


/***** Alexa.Notifications.SendMobilePush *****
  URL /push?device=?&text=?
    device - String - name of the device
    text - String - Text to display in the push notification
*/
CommandAlexa.Push = function(req,res){
	
	res.type('json');
	
	config.logger('Alexa-API:    Lancement /Push avec paramètres -> device: ' + req.query.device+' & text: ' + req.query.text);

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.Push', 'Missing parameter "device"'));
	if ('text' in req.query === false)	 return res.status(500).json(error(500, req.route.path, 'Alexa.Push', 'Missing parameter "text"'));

	let Commands = [];
	
	//Commands.push({command: 'volume', value: '60'});
	Commands.push({command: 'notification', value: req.query.text});
	//Commands.push({command: 'volume', value: '10'});

	boucleSurSerials_sendMultiSequenceCommand(req, Commands);
	
	res.status(200).json({value: "Send"});	//ne teste pas le résultat//supprimé 16/11/2019
}
/*
CommandAlexa.MultipleNext = function(req,res){
	
	res.type('json');
	
	config.logger('Alexa-API:    Lancement /MultipleNext avec paramètres -> device: ' + req.query.device+' & nb: ' + req.query.text);

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.MultipleNext', 'Missing parameter "device"'));
	//if ('text' in req.query === false)	 return res.status(500).json(error(500, req.route.path, 'Alexa.MultipleNext', 'Missing parameter "text"'));
req.query.command="next";
			
			alexa.sendCommand(req.query.device, req.query.command,
			function(){
				alexa.sendCommand(req.query.device, req.query.command,
			function(){
					alexa.sendCommand(req.query.device, req.query.command,
				function(){
					});
				});
			});
			


	
	res.status(200).json({value: "Send"});	//ne teste pas le résultat//supprimé 16/11/2019
}
*/
/***** DeleteReminder *****
  URL: /deletereminder

  Return the list of reminders
  [{
    id - String - id of the reminder (unique identifier)
  }]

*/
CommandAlexa.deleteReminder = function(req,res){
	
		config.logger('Alexa-API: deleteReminder' );
	
	LancementCommande("deleteReminder",req);
	res.type('json');

	if ('id' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.DeleteReminder', 'Missing parameter "id"'));

	const notification = {
		'id': req.query.id
	};

	alexa.deleteNotification(notification, function(err) {
		if (err)
			return res.status(500).json(error(500, req.route.path, 'Alexa.Notifications.DeleteReminder', err));
		res.status(200).json({});
	});
}


//!!!!!!!!!!!!!!!! Ne fonctionne pas, Response: {"message":"user not authorized"}
// Faudra creuser 
/* 
CommandAlexa.disableReminder = function(req,res){
	LancementCommande("disableReminder",req);
	res.type('json');

	if ('id' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.disableReminder', 'Missing parameter "id"'));

	const notification = {
		'id': req.query.id
	};
	const value = {
		'status': 'OFF'
	};	
config.logger('*************di>>>>>>>>>>>>>>>>>>>>><<<' );
console.log(notification);
	alexa.changeNotification(notification,value,function(err) {
		if (err)
			return res.status(500).json(error(500, req.route.path, 'Alexa.Notifications.disableReminder', err));
		res.status(200).json({});
	});
}

CommandAlexa.enableReminder = function(req,res){
	LancementCommande("enableReminder",req);
	res.type('json');

	if ('id' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.disableReminder', 'Missing parameter "id"'));

	const notification = {
		'id': req.query.id
	};
	config.logger('*************en>>>>>>>>>>>>>>>>>>>>><<<' );

	alexa.deleteNotification(notification, function(err) {
		if (err)
			return res.status(500).json(error(500, req.route.path, 'Alexa.Notifications.disableReminder', err));
		res.status(200).json({});
	});
}
*/
app.get('/checkAuth', CommandAlexa.checkAuth);
app.get('/query', CommandAlexa.query);
app.get('/command', CommandAlexa.Command);
app.get('/SmarthomeCommand', CommandAlexa.SmarthomeCommand);
app.get('/querySmarthomeDevices', CommandAlexa.querySmarthomeDevices);
app.get('/volume', CommandAlexa.Volume);
app.get('/speak', CommandAlexa.Speak);
app.get('/announcement', CommandAlexa.Announcement);
app.get('/radio', CommandAlexa.Radio);
app.get('/push', CommandAlexa.Push);
//app.get('/multiplenext', CommandAlexa.MultipleNext);
app.get('/deletereminder', CommandAlexa.deleteReminder);
//app.get('/enablereminder', CommandAlexa.enableReminder);
//app.get('/disablereminder', CommandAlexa.disableReminder);

/***** Alexa.Routine *****
  URL /routine?device=?&name=?
    device - String - name of the device
    routine - String - name of routine

*/
//app.get('/routine', (req, res) => {

CommandAlexa.Routine = function(req,res){
	LancementCommande("Routine",req);
	
	
		//config.logger('Alexa-API:    Lancement /Routine avec paramètres -> device: ' + req.query.device+' & value: ' + req.query.routine);

	
	res.type('json');

	if ('device' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.Routine', 'Missing parameter "device"'));
		config.logger('Alexa-API: device: ' + req.query.device, 'DEBUG');


	if ('routine' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.Routine', 'Missing parameter "routine"'));
	config.logger('Alexa-API: routine: ' + req.query.routine);


	alexa.getAutomationRoutines2(function(niveau0) {
		var toReturn = [];
		var routineaexecuter = "";

		for (var serial in niveau0) {
			if (niveau0.hasOwnProperty(serial)) {
				var routine = niveau0[serial];

				if (routine.creationTimeEpochMillis == req.query.routine)
					routineaexecuter = routine;
			}
		}
		if (routineaexecuter != '') 
			alexa.executeAutomationRoutine(req.query.device, routineaexecuter, traiteErreur);
		else
			config.logger('Alexa-API: routine - ECHEC (introuvable) - Lancement routine: ' + req.query.routine);

		res.status(200).json({});
	});
}
app.get('/routine', CommandAlexa.Routine);





/***** Create a reminder *****
  URL /reminder?device=?&text=?&when=?
    device - String - name of the device
    text - String - Content of the reminder
    when - String - Date at which the reminder should occur. Date format: YYYY-MM-DD HH24:MI:SS

  Return an empty object if the function succeed.
  Otherwise, an error object is returned.
*/
app.get('/reminder', (req, res) => {
	config.logger('Alexa-API: Alexa.Reminder');
	res.type('json');

	if ('device' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.Reminder', 'Missing parameter "device"'));
		config.logger('Alexa-API: device: ' + req.query.device, 'DEBUG');


	if ('text' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.Reminder', 'Missing parameter "text"'));
	config.logger('Alexa-API: text: ' + req.query.text);

	if ('when' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.Reminder', 'Missing parameter "when"'));
	config.logger('Alexa-API: when: ' + req.query.when);

	// when: YYYY-MM-DD HH:MI:SS
	let dateValues = req.query.when.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
	if (dateValues === null)
		return res.status(500).json(error(500, req.route.path, 'Alexa.Reminder', 'Invalid "when" format. Expected: YYYY-MM-DD HH:MI:SS'));
	let when = new Date(dateValues[1], dateValues[2] - 1, dateValues[3], dateValues[4], dateValues[5], dateValues[6]);
	config.logger('Alexa-API: when: ' + when);

	alexa.setReminder(req.query.device, when.getTime(), req.query.text, function(err) {
		if (err)
			return res.status(500).json(error(500, req.route.path, 'createReminder', err));
		res.status(200).json({});
	});
});


/***** Create a alarm *****
  URL /alarm?device=?&text=?&when=?
    device - String - name of the device
    text - String - Content of the alarm
    when - String - Date at which the alarm should occur. Date format: YYYY-MM-DD HH24:MI:SS

  Return an empty object if the function succeed.
  Otherwise, an error object is returned.
*/
app.get('/alarm', (req, res) => {
	config.logger('Alexa-API: Alexa.Alarm');
	res.type('json');

	if ('device' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.Alarm', 'Missing parameter "device"'));
		config.logger('Alexa-API: device: ' + req.query.device, 'DEBUG');


	if ('when' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.Alarm', 'Missing parameter "when"'));
	config.logger('Alexa-API: when: ' + req.query.when);

	if ('recurring' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.Alarm', 'Missing parameter "recurring"'));
	config.logger('Alexa-API: recurring: ' + req.query.recurring);
	config.logger('Alexa-API: sound: ' + req.query.sound);


	// when: YYYY-MM-DD HH:MI:SS
	let dateValues = req.query.when.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
	if (dateValues === null)
		return res.status(500).json(error(500, req.route.path, 'Alexa.Alarm', 'Invalid "when" format. Expected: YYYY-MM-DD HH:MI:SS'));
	let when = new Date(dateValues[1], dateValues[2] - 1, dateValues[3], dateValues[4], dateValues[5], dateValues[6]);
	config.logger('Alexa-API: when: ' + when);

	alexa.setAlarm(req.query.device, when.getTime(), req.query.recurring, req.query.sound, function(err) {
		if (err)
			return res.status(500).json(error(500, req.route.path, 'createReminder', err));
		res.status(200).json({});
	});
});


/***** Get devices *****
  URL: /devices

  Return the list of Alexa devices
  [{
    serial - String - Serial number of the device (unique identifier)
    name: String - name of the device. Use this name (or serial) to call as "device" parameter of others methods
    type: String - Device family as defined by Amazon. Known type: TABLET (for tablet device), ECHO (for ECHO device), WHA (for group of devices), VOX (for smartphone? Webpage?)
    online: Boolean - true when the device is connected, false otherwise,
    capabilities: [String] - List of available capabilties of the device, few example: VOLUME_SETTING, REMINDERS, MICROPHONE, TUNE_IN, ...
  }]
*/

app.get('/devices', (req, res) => {
	config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');
	res.type('json');

	alexa.getDevices(function(devices) {
		var toReturn = [];
		for (var serial in devices) {
			if (devices.hasOwnProperty(serial)) {
				var device = devices[serial];
				toReturn.push({
					'serial': serial,
					'name': device.accountName,
					'family': device.deviceFamily,
					'type': device.deviceType,
					'online': device.online,
					'capabilities': device.capabilities,
					'members': device.clusterMembers
				});
			}
		}
		res.status(200).json(toReturn);
	});
});

/***** Get devices *****
  URL: /devices

  Return the list of Alexa devices
  [{
    serial - String - Serial number of the device (unique identifier)
    name: String - name of the device. Use this name (or serial) to call as "device" parameter of others methods
    type: String - Device family as defined by Amazon. Known type: TABLET (for tablet device), ECHO (for ECHO device), WHA (for group of devices), VOX (for smartphone? Webpage?)
    online: Boolean - true when the device is connected, false otherwise,
    capabilities: [String] - List of available capabilties of the device, few example: VOLUME_SETTING, REMINDERS, MICROPHONE, TUNE_IN, ...
  }]
*/

   
// ---- Toutes les commandes qui n'ont pas de paramètres :   

CommandAlexa.wakeWords = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getWakeWords(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}



CommandAlexa.musicProviders = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getMusicProviders(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.discoverSmarthomeDevice = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_discoverSmarthomeDevice(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.historyFull = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getHistory(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.devicesFull = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	alexa.getDevices(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.devicePreferences = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getDevicePreferences(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.smarthomeBehaviourActionDefinitions = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getSmarthomeBehaviourActionDefinitions(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.smarthomeGroups = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getSmarthomeGroups(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.smarthomeEntities = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getSmarthomeEntities(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.homeGroup = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getHomeGroup(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.smarthomeDevices = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getSmarthomeDevices(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.remindersFull = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getNotifications(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.carts = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getCards(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.deviceStatusList = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getDeviceStatusList(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}


/*
CommandAlexa.doNotDisturb = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	Appel_getDoNotDisturb(function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}*/
// ---- Toutes les commandes qui ont DEVICE comme paramètre

CommandAlexa.media = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.'+commandeEnvoyee, 'Missing "device"'));
	config.logger('Alexa-API: device: ' + req.query.device, 'DEBUG');

	Appel_getMedia(req.query.device, function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'-'+req.query.device+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.playerInfo = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');	
	res.type('json');

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.'+commandeEnvoyee, 'Missing "device"'));
	config.logger('Alexa-API: device: ' + req.query.device, 'DEBUG');

	Appel_getPlayerInfo(req.query.device, function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'-'+req.query.device+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.Bluetooth = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: **************/'+commandeEnvoyee);
	res.type('json');

	Appel_getBluetooth(false, function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'-'+req.query.device+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.notificationSounds = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: **************/'+commandeEnvoyee);
	res.type('json');

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.'+commandeEnvoyee, 'Missing "device"'));
	config.logger('Alexa-API: device: ' + req.query.device, 'DEBUG');

	Appel_getNotificationSounds(req.query.device, function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'-'+req.query.device+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.Playlists = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');
	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.'+commandeEnvoyee, 'Missing "device"'));
	config.logger('Alexa-API: device: ' + req.query.device, 'DEBUG');

	Appel_Playlists(req.query.device, function(retourAmazon) {
		//config.logger('Alexa-API: retour: ' + commandeEnvoyee);
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'-'+req.query.device+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.activities = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.'+commandeEnvoyee, 'Missing "device"'));
	config.logger('Alexa-API: device: ' + req.query.device, 'DEBUG');

	Appel_getActivities(req.query.device, function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'-'+req.query.device+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.lists = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.'+commandeEnvoyee, 'Missing "device"'));
		config.logger('Alexa-API: device: ' + req.query.device, 'DEBUG');


	Appel_getLists(req.query.device, function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'-'+req.query.device+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}

CommandAlexa.deviceNotificationState = function(req, res) {
	commandeEnvoyee = req.path.replace("/", "");
	config.logger('Alexa-API: Lancement de /'+commandeEnvoyee+' sur '+req.query.device, 'INFO');
	res.type('json');

	if ('device' in req.query === false) return res.status(500).json(error(500, req.route.path, 'Alexa.'+commandeEnvoyee, 'Missing "device"'));
		config.logger('Alexa-API: device: ' + req.query.device, 'DEBUG');


	Appel_getDeviceNotificationState(req.query.device, function(retourAmazon) {
		fichierjson = __dirname + '/data/'+commandeEnvoyee+'-'+req.query.device+'.json';
		fs.writeFile(fichierjson, JSON.stringify(retourAmazon, null, 2), err =>
			{if (err) return res.sendStatus(500)});
		res.status(200).json(retourAmazon);
	});
}
// ---- Functions d'appel des Commandes de la librairie

function Appel_getWakeWords(callback) 
	{
	alexa.getWakeWords((err, res) => {if (err || !res || !res.wakeWords || !Array.isArray(res.wakeWords)) return callback && callback();
	callback && callback(res);});
	}
	

	
function Appel_getDevicePreferences(callback) 
	{
	alexa.getDevicePreferences((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getMusicProviders(callback) 
	{
	alexa.getMusicProviders((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getHistory(callback) 
	{
	alexa.getHistory((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getDeviceNotificationState(serialOrName,callback) 
	{
	alexa.getDeviceNotificationState(serialOrName,(err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getNotifications(callback) 
	{
	alexa.getNotifications((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}	
	
function Appel_getSmarthomeBehaviourActionDefinitions(callback) 
	{
	alexa.getSmarthomeBehaviourActionDefinitions((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getCards(callback) 
	{
	alexa.getCards((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getSmarthomeGroups(callback) 
	{
	alexa.getSmarthomeGroups((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getSmarthomeEntities(callback) 
	{
	alexa.getSmarthomeEntities((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
		
function Appel_getHomeGroup(callback) 
	{
	alexa.getHomeGroup((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_discoverSmarthomeDevice(callback) 
	{
	alexa.discoverSmarthomeDevice((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getSmarthomeDevices(callback) 
	{
	alexa.getSmarthomeDevices((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getDeviceStatusList(callback) 
	{
	alexa.getDeviceStatusList((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_Playlists(serialOrName,callback) 
	{
	alexa.Playlists(serialOrName,(err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}	
	/*
function Appel_getDoNotDisturb(callback) 
	{
	alexa.getDoNotDisturb((err, res) => {if (err) return callback && callback();
	callback && callback(res);});
	}	*/
function Appel_getMedia(serialOrName,callback) 
	{
	alexa.getMedia(serialOrName,(err, res) => {if (err || !res ) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getPlayerInfo(serialOrName,callback) 
	{
	alexa.getPlayerInfo(serialOrName,(err, res) => {if (err || !res ) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getBluetooth(cached,callback) 
	{
	alexa.getBluetooth(cached,(err, res) => {if (err || !res ) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getNotificationSounds(serialOrName, callback) 
	{
	alexa.getNotificationSounds(serialOrName,(err, res) => {if (err || !res ) return callback && callback();
	callback && callback(res);});
	}	

	
function Appel_getActivities(serialOrName,callback) 
	{
	alexa.getActivities(serialOrName,(err, res) => {if (err || !res ) return callback && callback();
	callback && callback(res);});
	}
	
function Appel_getLists(serialOrName,callback) 
	{
	alexa.getLists(serialOrName,(err, res) => {if (err || !res ) return callback && callback();
	callback && callback(res);});
	}	
	// Tous les appels GET

app.get('/wakeWords', CommandAlexa.wakeWords);
app.get('/media', CommandAlexa.media);
app.get('/playerInfo', CommandAlexa.playerInfo);
app.get('/bluetooth', CommandAlexa.Bluetooth);
app.get('/notificationSounds', CommandAlexa.notificationSounds);
app.get('/activities', CommandAlexa.activities);
app.get('/devicePreferences', CommandAlexa.devicePreferences);
app.get('/homeGroup', CommandAlexa.homeGroup);
app.get('/smarthomeDevices', CommandAlexa.smarthomeDevices);
app.get('/smarthomeBehaviourActionDefinitions', CommandAlexa.smarthomeBehaviourActionDefinitions);
app.get('/smarthomeGroups', CommandAlexa.smarthomeGroups);
app.get('/smarthomeEntities', CommandAlexa.smarthomeEntities);
app.get('/devicesFull', CommandAlexa.devicesFull);
app.get('/historyFull', CommandAlexa.historyFull);
app.get('/discoverSmarthomeDevice', CommandAlexa.discoverSmarthomeDevice);
app.get('/musicProviders', CommandAlexa.musicProviders);
app.get('/remindersFull', CommandAlexa.remindersFull);
app.get('/lists', CommandAlexa.lists);
app.get('/carts', CommandAlexa.carts);
app.get('/deviceNotificationState', CommandAlexa.deviceNotificationState);
app.get('/deviceStatusList', CommandAlexa.deviceStatusList);
app.get('/playlists', CommandAlexa.Playlists);
app.get('/playlist', CommandAlexa.playList);
app.get('/playmusictrack', CommandAlexa.playMusicTrack);



app.get('/getvolume', (req, res) => {
	res.type('json');
	config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');

	if ('device' in req.query === false)
		return res.status(500).json(error(500, req.route.path, 'Alexa.getVolume', 'Missing parameter "device"'));
		config.logger('Alexa-API: device: ' + req.query.device, 'DEBUG');


		//var valeurvolume="";

	alexa.getMedia2(req.query.device, function(devices) {
		
		//var toReturn = [];
			config.logger('Alexa-API: trouve volume :'+devices["volume"]);
			//valeurvolume=devices["volume"];
			res.status(200).json({		value: devices["volume"]	});

});
});

app.get('/history', (req, res) => {
	config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');
	res.type('json');


	if ('size' in req.query === false)
		req.query.size = 5;
	if ('offset' in req.query === false)
		req.query.offset = 1;

	const options = {
		size: req.query.size,
		offset: req.query.offset
	};

	alexa.getHistory2(options, function(devices) {
		var toReturn = [];

		//console.log(devices);

		for (var serial in devices) {
			if (devices.hasOwnProperty(serial)) {
				var activities = devices[activities];
				var device = devices[serial];
				toReturn.push({
					'serial': serial,
					'activityStatus': device.activityStatus,
					'deviceSerialNumber': device.deviceSerialNumber,
					'creationTimestamp': device.creationTimestamp,
					'summary': device.description.summary
				});
			}
		}
		res.status(200).json(toReturn);
	});
});


/***** routines *****
  URL: /routines

*/
app.get('/routines', (req, res) => {
	config.logger('Alexa-API: Lancement de '+req.path, 'INFO');
	res.type('json');

	//config.logger('Alexa-API: type of devices : '+typeof devices);

	alexa.getAutomationRoutines2(function(niveau0) {
		//devices='{"notifications":'+devices+'}';

		//config.logger('Alexa-API: routines2');
		//  config.logger(JSON.stringify(devices));
		//  config.logger(devices);

		//config.logger('Alexa-API: type of devices : '+typeof devices);
		var resultatutterance;
		var resultatlocale;
		var resultattriggerTime;
		var resultattimeZoneId;
		var resultatrecurrence;
		//config.logger('Alexa-API: routines3b2');
		var toReturn = [];
		config.logger('************DEBUG DE ROUTINES*******************');
		config.logger('************Résultat de la requète Routines : '+JSON.stringify(niveau0));
		for (var serial in niveau0) {
			if (niveau0.hasOwnProperty(serial)) {
				//config.logger('************************************************');

				var routine = niveau0[serial];

				//config.logger('(general)----- '+routine.status);
				//config.logger('(general)----- '+routine.creationTimeEpochMillis);

				if (routine.status === 'ENABLED') {
					//config.logger('(SUPPRESSION)----- '+routine.creationTimeEpochMillis);
					alexa.executeAutomationRoutine("", routine, function(err) {
						//config.logger('(SUPPRESSION DEDANS)----- '+routine.creationTimeEpochMillis);
						//executeAutomationRoutine(serialOrName, routine, callback)
						//res.status(200).json({});
					});
					//config.logger('(SUPPRESSION)----- '+routine.creationTimeEpochMillis);
				}



				for (var serial2 in routine.triggers) {
					if (routine.triggers.hasOwnProperty(serial2)) {
						var niveau2 = routine.triggers[serial2];

						resultatutterance = "";
						resultatlocale = "";
						resultattriggerTime = "";
						resultattimeZoneId = "";
						resultatrecurrence = "";

						for (var triggers in niveau2.payload) { //Partie PAYLOAD
							if (niveau2.payload.hasOwnProperty(triggers)) {
								var niveau3 = niveau2.payload[triggers];
								//config.logger('(triggers1)----- '+triggers.locale);
								//config.logger('(triggers2)----- '+niveau3.locale);	
								//config.logger('(triggers3)----- '+triggers+' : '+niveau3);

								switch (triggers) {

									case 'utterance':
										resultatutterance = niveau3;
										break;

									case 'locale':
										resultatlocale = niveau3;
										break;

									case 'schedule':
										for (var schedule in niveau3) { //Partie schedule
											if (niveau3.hasOwnProperty(schedule)) {
												var niveau4 = niveau3[schedule];
												//config.logger('(schedule)----- '+schedule+' : '+niveau4);

												switch (schedule) {

													case 'triggerTime':
														resultattriggerTime = niveau4;
														break;

													case 'timeZoneId':
														resultattimeZoneId = niveau4;
														break;
													case 'recurrence':
														resultatrecurrence = niveau4;
														break;
												}
											}
										}
										break;


								}
							}
						}
					}
				}
				/*
						for (Var serial2 in routine.sequence) //partie SEQUENCE non utilisé à ce stade
						{
							  var niveau2 = routine[serial2];
								
								config.logger('(sequence)----- '+serial2+' : '+niveau2);


						}
						
						
						
				*/




				toReturn.push({
					'status': routine.status,
					'locale': resultatlocale,
					'utterance': resultatutterance,
					'triggerTime': resultattriggerTime,
					'timeZoneId': resultattimeZoneId,
					'recurrence': resultatrecurrence,

					'creationTimeEpochMillis': routine.creationTimeEpochMillis,
					'lastUpdatedTimeEpochMillis': routine.lastUpdatedTimeEpochMillis
					// 'members': device.clusterMembers
				});

				
			}
		}
	res.status(200).json(toReturn);
	});
});


/***** Reminders *****
  URL: /reminders

  Return the list of reminders
  [{
    serial - String - Serial nu=mber of the device (unique identifier)
    name: String - name of the device. Use this name (or serial) to call as "device" parameter of others methods
    type: String - Device family as defined by Amazon. Known type: TABLET (for tablet device), ECHO (for ECHO device), WHA (for group of devices), VOX (for smartphone? Webpage?)
    online: Boolean - true when the device is connected, false oe,
    capabilities: [String] - List of available capabilties of the device, few example: VOLUME_SETTING, REMINDERS, MICROPHONE, TUNE_IN, ...
  }]

*/
app.get('/reminders', (req, res) => {
	config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');
	res.type('json');

	//config.logger('Alexa-API: (reminders) Lancement','DEBUG');

	alexa.getNotifications2(function(notifications) {
		//config.logger('Alexa-API: (reminders) function','DEBUG');
		var toReturn = [];

		for (var serial in notifications) {
			if (notifications.hasOwnProperty(serial)) {
				var device = notifications[serial];
				toReturn.push({
					'serial': serial,
					'deviceSerialNumber': device.deviceSerialNumber,
					'type': device.type,
					'originalTime': device.originalTime,
					'musicEntity': device.musicEntity,
					'soundDisplayName': device.sound.displayName,
					'originalDate': device.originalDate,
					'remainingTime': device.remainingTime,
					'status': device.status,
					'recurringPattern': device.recurringPattern,
					'reminderLabel': device.reminderLabel,
					'id': device.id
				});
			}
		}
		res.status(200).json(toReturn);
	});
});





/***** DeleteAllAlarms *****
  URL: /deleteallalarms

  Supprime toutes les alamrmes et/ou tous les rappels
  [{
    
  }]

*/
app.get('/deleteallalarms', (req, res) => {
	config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');
	res.type('json');

	alexa.getNotifications2(function(notifications) {
		//var toReturn = [];
		//config.logger('Alexa-API - prepa boucle 1:'+JSON.stringify(notifications),'INFO');
		//config.logger('Alexa-API - prepa boucle 1 nb:'+Object.keys(notifications).length,'INFO');
		// Filtre et ne garde que les enregistrements du device selctionné
		const notificationsfiltrees = notifications.filter(tmp => tmp.deviceSerialNumber == req.query.device);
		
		
		notifications = notificationsfiltrees;
		//config.logger('Alexa-API - on filtre sur req.query.device:'+req.query.device,'INFO');
		//config.logger('Alexa-API - prepa boucle 2:'+JSON.stringify(notifications),'INFO');
		//config.logger('Alexa-API - prepa boucle 2 nb:'+Object.keys(notifications).length,'INFO');

		//config.logger('Alexa-API - deleteallalarms req.query.type: ' + req.query.type,'DEBUG');
		//config.logger('Alexa-API - on filtre sur req.query.type:'+req.query.type,'INFO');

		if ((req.query.type != 'all') && (req.query.type != 'ALL')) {
			var notificationsfiltrees1;
			if ((req.query.type.toUpperCase() == 'reminder'.toUpperCase()) || (req.query.type.toUpperCase() == 'reminders'.toUpperCase()))
				notificationsfiltrees1 = notifications.filter(tmp => tmp.type == "Reminder");
			else
				notificationsfiltrees1 = notifications.filter(tmp => tmp.type == "Alarm"); //Par défaut donc
			notifications = notificationsfiltrees1;
		}

		//config.logger('Alexa-API - prepa boucle 3:'+JSON.stringify(notifications),'INFO');
		//config.logger('Alexa-API - prepa boucle 3 nb:'+Object.keys(notifications).length,'INFO');

		// Filtre et ne garde que les enregistrements qui ont un status qui correspond à req.query.status
		if ((req.query.status != 'all') && (req.query.status != 'ALL')) {
			var FiltreSurStatus = 'ON';
			if ((req.query.status == 'off') || (req.query.status == 'OFF')) FiltreSurStatus = 'OFF';
			const notificationsfiltrees2 = notifications.filter(tmp => tmp.status == FiltreSurStatus);
			notifications = notificationsfiltrees2;
		}

		//config.logger('Alexa-API - prepa boucle 5:'+JSON.stringify(notifications),'INFO');
		config.logger('Alexa-API - prepa boucle 5 nb:'+Object.keys(notifications).length,'INFO');


		for (var serial in notifications) {
			//config.logger('Alexa-API - boucle ','INFO');			
			if (notifications.hasOwnProperty(serial)) {
				// On va parcourir les résultats et supprimer chaque enregistrement

				var device = notifications[serial];
				config.logger('Alexa-API - DeleteAllAlarms delete id: ' + device.id);

				const notification = {
					'id': device.id
				};
				//config.logger('Alexa-API - AVANT deleteallalarms device.id: ' + device.id,'INFO');
				
				alexa.deleteNotification(notification, function(err) {});
	

				
			}
		}
	});

	res.status(200).json({
		value: "Fini"
	});
});






/***** WhenNextAlarm *****
  URL: /whennextalarm

  Return la prochaine alarme
  [{
    position => 1= prochaine 2=suivante ...
	status => Filtre sur le status (active=ON, désactive=OFF, Tous =ALL)
	format => Format du résultat (HOUR=réduit HH:SS)
  }]

*/
app.get('/whennextalarm', (req, res) => {
	config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');
	res.type('json');

	alexa.getNotifications2(function(notifications) {
		//config.logger('Alexa-API: (WhenNextAlarm) function' );
		//var toReturn = [];

		if (isEmpty(notifications))
			return res.status(500).json(error(500, req.route.path, 'Alexa.whennextalarm', 'Retour vide'));


		// Filtre et ne garde que les enregistrements du device selctionné
		const notificationsfiltrees = notifications.filter(tmp => tmp.deviceSerialNumber == req.query.device);
		notifications = notificationsfiltrees;

		// Filtre et ne garde que les enregistrements qui ont le type ALARM
		const notificationsfiltrees1 = notifications.filter(tmp => tmp.type == "Alarm");
		notifications = notificationsfiltrees1;


		// Filtre et ne garde que les enregistrements qui sont supérieure à l'heure du jour
		//Maintenant :
		var d = new Date();
		var date_format_str = d.getFullYear().toString() + "-" + ((d.getMonth() + 1).toString().length == 2 ? (d.getMonth() + 1).toString() : "0" + (d.getMonth() + 1).toString()) + "-" + (d.getDate().toString().length == 2 ? d.getDate().toString() : "0" + d.getDate().toString()) + " " + (d.getHours().toString().length == 2 ? d.getHours().toString() : "0" + d.getHours().toString()) + ":" + ((parseInt(d.getMinutes() / 5) * 5).toString().length == 2 ? (parseInt(d.getMinutes() / 5) * 5).toString() : "0" + (parseInt(d.getMinutes() / 5) * 5).toString()) + ":00";
		const notificationsfiltrees4 = notifications.filter(tmp => (tmp.originalDate + ' ' + tmp.originalTime > date_format_str));
		notifications = notificationsfiltrees4;

		// Filtre et ne garde que les enregistrements qui ont un status qui correspond à req.query.status
		if ((req.query.status != 'all') && (req.query.status != 'ALL')) {
			var FiltreSurStatus = 'ON';
			if ((req.query.status == 'off') || (req.query.status == 'OFF')) FiltreSurStatus = 'OFF';
			const notificationsfiltrees2 = notifications.filter(tmp => tmp.status == FiltreSurStatus);
			notifications = notificationsfiltrees2;
		}

		// Trie par Date/Heure
		const notificationsfiltrees3 = notifications.sort(function(a, b) {
			var x = a.originalDate + a.originalTime;
			var y = b.originalDate + b.originalTime;
			return ((x < y) ? -1 : ((x > y) ? 1 : 0));
		});
		notifications = notificationsfiltrees3;


		var compteurdePosition = 1;
		var compteurdePositionaTrouver = 1;
		var stringarenvoyer = 'none';

		if (req.query.position > 1) {
			compteurdePositionaTrouver = req.query.position;
		}

		for (var serial in notifications) {
			if (notifications.hasOwnProperty(serial)) {
				// On va parcourir les résultats en allant à la position demandée.

				if (compteurdePositionaTrouver == compteurdePosition) {
					var device = notifications[serial];

					switch (req.query.format) {
						case 'hour':
						case 'HOUR':
							stringarenvoyer = device.originalTime.substring(0, 5);
							break;
						case 'full':
						case 'FULL':
							stringarenvoyer = device.originalDate + " " + device.originalTime;
							break;
						default: //ou HHMM
							stringarenvoyer = device.originalTime.substring(0, 5).replace(':', ''); // Utilisation du format HH:MM
					}

				}
				compteurdePosition++;
			}
		}
		res.status(200).json({
			value: stringarenvoyer
		});

	});
});


/***** updateallalarms *****
  URL: /updateallalarms

*/
app.get('/updateallalarms', (req, res) => {
	config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');
	res.type('json');

	// c'était pour générer la liste des devices
	/*alexa.getDevices(function(devices) {
		var lesDevices = [];
		for (var serial in devices) {lesDevices.push(serial);}
		config.logger('Alexa-API: DEVICES '+JSON.stringify(lesDevices), 'INFO');
	*/


function ajouteZero(n){
  if(n <= 9){
    return "0" + n;
  }
  return n
}


	alexa.getNotifications2(function(notifications) {
		//config.logger('Alexa-API: (WhenNextAlarm) function' );
		//var toReturn = [];

		if (isEmpty(notifications))
			return res.status(500).json(error(500, req.route.path, 'Alexa.updateallalarms', 'Retour vide'));

		// Filtre et ne garde que les enregistrements du device selctionné
		const notificationsfiltrees = notifications.filter(tmp => tmp.deviceSerialNumber == req.query.device);
		notifications = notificationsfiltrees;


		// Filtre et ne garde que les enregistrements qui sont supérieure à l'heure du jour
		//Maintenant :
		var d = new Date();
		var date_format_str = d.getFullYear().toString() + "-" + ((d.getMonth() + 1).toString().length == 2 ? (d.getMonth() + 1).toString() : "0" + (d.getMonth() + 1).toString()) + "-" + (d.getDate().toString().length == 2 ? d.getDate().toString() : "0" + d.getDate().toString()) + " " + (d.getHours().toString().length == 2 ? d.getHours().toString() : "0" + d.getHours().toString()) + ":" + ((parseInt(d.getMinutes() / 5) * 5).toString().length == 2 ? (parseInt(d.getMinutes() / 5) * 5).toString() : "0" + (parseInt(d.getMinutes() / 5) * 5).toString()) + ":00";
		const notificationsfiltrees4 = notifications.filter(tmp => (tmp.originalDate + ' ' + tmp.originalTime > date_format_str));
		notifications = notificationsfiltrees4;

		// Filtre et ne garde que les enregistrements qui ont un status qui correspond à req.query.status
		//if ((req.query.status != 'all') && (req.query.status != 'ALL')) {
			var FiltreSurStatus = 'ON';
			//if ((req.query.status == 'off') || (req.query.status == 'OFF')) FiltreSurStatus = 'OFF';
			const notificationsfiltrees2 = notifications.filter(tmp => tmp.status == FiltreSurStatus);
			notifications = notificationsfiltrees2;
		//}

		// Trie par Date/Heure
		const notificationsfiltrees3 = notifications.sort(function(a, b) {
			var x = a.originalDate + a.originalTime;
			var y = b.originalDate + b.originalTime;
			return ((x < y) ? -1 : ((x > y) ? 1 : 0));
		});
		notifications = notificationsfiltrees3;

		whennextmusicalalarminfo='none';
		musicalalarmmusicentityinfo='';
		whennextreminderinfo='none';
		whennextreminderlabelinfo='';
		whennextalarminfo='none';
		whennextmusicalalarminfo='none';
		whennextreminderinfo='none';
		whennexttimerinfo='none';
		
		var toReturn = [];		

		// Filtre et ne garde que les enregistrements qui ont le type ALARM
		const quelesAlarmes = notifications.filter(tmp => tmp.type == "Alarm");
		let device=quelesAlarmes.shift();
		if (device) { 
			//var h=device.originalTime; 
			//var d=device.originalDate; 
			var original=new Date(device.originalDate + ' ' + device.originalTime);
			let formatted_date = original.getFullYear() + "-" + ajouteZero(original.getMonth() + 1) + "-" + ajouteZero(original.getDate()) + " " + ajouteZero(original.getHours()) + ":" + ajouteZero(original.getMinutes()) + ":" + ajouteZero(original.getSeconds())
			whennextalarminfo=formatted_date;
		} 
		
		const quelesMinuteurs = notifications.filter(tmp => tmp.type == "Timer");
		device=quelesMinuteurs.shift();
//		config.logger('Alexa-API: (---) :'+JSON.stringify(device));
		//config.logger('Alexa-API: (---) :'+device.remainingTime);
		if (device) { 
			let A = new Date();
			A.setSeconds(device.remainingTime/1000);
			var secondes = A.getSeconds();
				if(secondes < 10)
					  secondes = "0" + secondes;
			var minutes = A.getMinutes();
				if(minutes < 10)
					  minutes = "0" + minutes;			
			var jours = A.getDate();
				if(jours < 10)
					  jours = "0" + jours;			
			var month = new Array();
				month[0] = "01";
				month[1] = "02";
				month[2] = "03";
				month[3] = "04";
				month[4] = "05";
				month[5] = "06";
				month[6] = "07";
				month[7] = "08";
				month[8] = "09";
				month[9] = "10";
				month[10] = "11";
				month[11] = "12";
			//whennexttimerinfo=minutes+" "+A.getHours()+" "+jours+ " "+month[A.getMonth()]+ " "+A.getDay()+ " "+A.getFullYear();
			whennexttimerinfo=A.getFullYear()+"-"+month[A.getMonth()]+"-"+jours+ " "+A.getHours()+":"+minutes+":"+secondes;
			//2019-12-02 19:04:01
		} 
		
		const quelesAlarmesMusicales = notifications.filter(tmp => tmp.type == "MusicAlarm");
		device=quelesAlarmesMusicales.shift();
		if (device) { 
			var original=new Date(device.originalDate + ' ' + device.originalTime);
			let formatted_date = original.getFullYear() + "-" + ajouteZero(original.getMonth() + 1) + "-" + ajouteZero(original.getDate()) + " " + ajouteZero(original.getHours()) + ":" + ajouteZero(original.getMinutes()) + ":" + ajouteZero(original.getSeconds())
			whennextmusicalalarminfo=formatted_date;
			musicalalarmmusicentityinfo=device.musicEntity;
		} 

		const quelesRappels = notifications.filter(tmp => tmp.type == "Reminder");
		device=quelesRappels.shift();
		if (device) { 
			var original=new Date(device.originalDate + ' ' + device.originalTime);
			let formatted_date = original.getFullYear() + "-" + ajouteZero(original.getMonth() + 1) + "-" + ajouteZero(original.getDate()) + " " + ajouteZero(original.getHours()) + ":" + ajouteZero(original.getMinutes()) + ":" + ajouteZero(original.getSeconds())
			whennextreminderinfo=formatted_date;
			whennextreminderlabelinfo=device.reminderLabel;
		} 


		toReturn.push({
					'musicalalarmmusicentityinfo': musicalalarmmusicentityinfo,
					'whennextalarminfo': whennextalarminfo,
					'whennextmusicalalarminfo': whennextmusicalalarminfo,
					'whennextreminderinfo': whennextreminderinfo,
					'whennexttimerinfo': whennexttimerinfo,
					'whennextreminderlabelinfo': whennextreminderlabelinfo
				});
		res.status(200).json(toReturn);
	});

	//});// retour de alexa.getDevices
});



/***** WhenNextMusicalAlarm *****
  URL: /whennextalarm

  Return la prochaine alarme musicale
  [{
    position => 1= prochaine 2=suivante ...
	status => Filtre sur le status (active=ON, désactive=OFF, Tous =ALL)
	format => Format du résultat (HOUR=réduit HH:SS)
  }]

*/
app.get('/whennextmusicalalarm', (req, res) => {
	config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');
	res.type('json');

	alexa.getNotifications2(function(notifications) {
		//config.logger('Alexa-API: (WhenNextAlarm) function' );
		//var toReturn = [];

		if (isEmpty(notifications))
			return res.status(500).json(error(500, req.route.path, 'Alexa.whennextalarm', 'Retour vide'));


		// Filtre et ne garde que les enregistrements du device selctionné
		const notificationsfiltrees = notifications.filter(tmp => tmp.deviceSerialNumber == req.query.device);
		notifications = notificationsfiltrees;

		// Filtre et ne garde que les enregistrements qui ont le type ALARM
		const notificationsfiltrees1 = notifications.filter(tmp => tmp.type == "MusicAlarm");
		notifications = notificationsfiltrees1;


		// Filtre et ne garde que les enregistrements qui sont supérieure à l'heure du jour
		//Maintenant :
		var d = new Date();
		var date_format_str = d.getFullYear().toString() + "-" + ((d.getMonth() + 1).toString().length == 2 ? (d.getMonth() + 1).toString() : "0" + (d.getMonth() + 1).toString()) + "-" + (d.getDate().toString().length == 2 ? d.getDate().toString() : "0" + d.getDate().toString()) + " " + (d.getHours().toString().length == 2 ? d.getHours().toString() : "0" + d.getHours().toString()) + ":" + ((parseInt(d.getMinutes() / 5) * 5).toString().length == 2 ? (parseInt(d.getMinutes() / 5) * 5).toString() : "0" + (parseInt(d.getMinutes() / 5) * 5).toString()) + ":00";
		const notificationsfiltrees4 = notifications.filter(tmp => (tmp.originalDate + ' ' + tmp.originalTime > date_format_str));
		notifications = notificationsfiltrees4;

		// Filtre et ne garde que les enregistrements qui ont un status qui correspond à req.query.status
		if ((req.query.status != 'all') && (req.query.status != 'ALL')) {
			var FiltreSurStatus = 'ON';
			if ((req.query.status == 'off') || (req.query.status == 'OFF')) FiltreSurStatus = 'OFF';
			const notificationsfiltrees2 = notifications.filter(tmp => tmp.status == FiltreSurStatus);
			notifications = notificationsfiltrees2;
		}

		// Trie par Date/Heure
		const notificationsfiltrees3 = notifications.sort(function(a, b) {
			var x = a.originalDate + a.originalTime;
			var y = b.originalDate + b.originalTime;
			return ((x < y) ? -1 : ((x > y) ? 1 : 0));
		});
		notifications = notificationsfiltrees3;


		var compteurdePosition = 1;
		var compteurdePositionaTrouver = 1;
		var stringarenvoyer = 'none';
		var stringMusicarenvoyer = 'none';

		if (req.query.position > 1) {
			compteurdePositionaTrouver = req.query.position;
		}

		for (var serial in notifications) {
			if (notifications.hasOwnProperty(serial)) {
				// On va parcourir les résultats en allant à la position demandée.

				if (compteurdePositionaTrouver == compteurdePosition) {
					var device = notifications[serial];
					stringMusicarenvoyer = device.musicEntity;
					switch (req.query.format) {
						case 'hour':
						case 'HOUR':
							stringarenvoyer = device.originalTime.substring(0, 5);
							break;
						case 'full':
						case 'FULL':
							stringarenvoyer = device.originalDate + " " + device.originalTime;
							break;
						default: //ou HHMM
							stringarenvoyer = device.originalTime.substring(0, 5).replace(':', ''); // Utilisation du format HH:MM
					}

				}
				compteurdePosition++;
			}
		}
		res.status(200).json({
			value: stringarenvoyer,
			music: stringMusicarenvoyer
		});

	});
});


/***** musicalalarmmusicentity *****


  Return la  musique de la prochaine alarme musicale
  [{
    position => 1= prochaine 2=suivante ...
	status => Filtre sur le status (active=ON, désactive=OFF, Tous =ALL)
  }]

*/
app.get('/musicalalarmmusicentity', (req, res) => {
	config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');
	res.type('json');

	alexa.getNotifications2(function(notifications) {


		if (isEmpty(notifications))
			return res.status(500).json(error(500, req.route.path, 'Alexa.whennextalarm', 'Retour vide'));


		// Filtre et ne garde que les enregistrements du device selctionné
		const notificationsfiltrees = notifications.filter(tmp => tmp.deviceSerialNumber == req.query.device);
		notifications = notificationsfiltrees;

		// Filtre et ne garde que les enregistrements qui ont le type ALARM
		const notificationsfiltrees1 = notifications.filter(tmp => tmp.type == "MusicAlarm");
		notifications = notificationsfiltrees1;


		// Filtre et ne garde que les enregistrements qui sont supérieure à l'heure du jour
		//Maintenant :
		var d = new Date();
		var date_format_str = d.getFullYear().toString() + "-" + ((d.getMonth() + 1).toString().length == 2 ? (d.getMonth() + 1).toString() : "0" + (d.getMonth() + 1).toString()) + "-" + (d.getDate().toString().length == 2 ? d.getDate().toString() : "0" + d.getDate().toString()) + " " + (d.getHours().toString().length == 2 ? d.getHours().toString() : "0" + d.getHours().toString()) + ":" + ((parseInt(d.getMinutes() / 5) * 5).toString().length == 2 ? (parseInt(d.getMinutes() / 5) * 5).toString() : "0" + (parseInt(d.getMinutes() / 5) * 5).toString()) + ":00";
		const notificationsfiltrees4 = notifications.filter(tmp => (tmp.originalDate + ' ' + tmp.originalTime > date_format_str));
		notifications = notificationsfiltrees4;

		// Filtre et ne garde que les enregistrements qui ont un status qui correspond à req.query.status
		if ((req.query.status != 'all') && (req.query.status != 'ALL')) {
			var FiltreSurStatus = 'ON';
			if ((req.query.status == 'off') || (req.query.status == 'OFF')) FiltreSurStatus = 'OFF';
			const notificationsfiltrees2 = notifications.filter(tmp => tmp.status == FiltreSurStatus);
			notifications = notificationsfiltrees2;
		}

		// Trie par Date/Heure
		const notificationsfiltrees3 = notifications.sort(function(a, b) {
			var x = a.originalDate + a.originalTime;
			var y = b.originalDate + b.originalTime;
			return ((x < y) ? -1 : ((x > y) ? 1 : 0));
		});
		notifications = notificationsfiltrees3;


		var compteurdePosition = 1;
		var compteurdePositionaTrouver = 1;
		//var stringarenvoyer = 'none';
		var stringMusicarenvoyer = 'none';

		if (req.query.position > 1) {
			compteurdePositionaTrouver = req.query.position;
		}

		for (var serial in notifications) {
			if (notifications.hasOwnProperty(serial)) {
				// On va parcourir les résultats en allant à la position demandée.

				if (compteurdePositionaTrouver == compteurdePosition) {
					var device = notifications[serial];
					stringMusicarenvoyer = device.musicEntity;
					/*
					switch (req.query.format) {
						case 'hour':
						case 'HOUR':
							stringarenvoyer = device.originalTime.substring(0, 5);
							break;
						case 'full':
						case 'FULL':
							stringarenvoyer = device.originalDate + " " + device.originalTime;
							break;
						default: //ou HHMM
							stringarenvoyer = device.originalTime.substring(0, 5).replace(':', ''); // Utilisation du format HH:MM
					}*/

				}
				compteurdePosition++;
			}
		}
		res.status(200).json({
			value: stringMusicarenvoyer
		});

	});
});

/***** WhenNextReminder *****
  URL: /whennextreminder

  Return le prochain rappel
  [{
    position => 1= prochaine 2=suivante ...
	status => Filtre sur le status (active=ON, désactive=OFF, Tous =ALL)
	format => Format du résultat (HOUR=réduit HH:SS)
  }]

*/
app.get('/whennextreminder', (req, res) => {
	config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');
	res.type('json');


	alexa.getNotifications2(function(notifications) {

		if (isEmpty(notifications))
			return res.status(500).json(error(500, req.route.path, 'Alexa.whennextreminder', 'Retour vide'));

		// Filtre et ne garde que les enregistrements du device selctionné
		const notificationsfiltrees = notifications.filter(tmp => tmp.deviceSerialNumber == req.query.device);
		notifications = notificationsfiltrees;

		// Filtre et ne garde que les enregistrements qui ont le type ALARM
		const notificationsfiltrees1 = notifications.filter(tmp => tmp.type == "Reminder");
		notifications = notificationsfiltrees1;


		// Filtre et ne garde que les enregistrements qui sont supérieure à l'heure du jour
		//Maintenant :
		var d = new Date();
		var date_format_str = d.getFullYear().toString() + "-" + ((d.getMonth() + 1).toString().length == 2 ? (d.getMonth() + 1).toString() : "0" + (d.getMonth() + 1).toString()) + "-" + (d.getDate().toString().length == 2 ? d.getDate().toString() : "0" + d.getDate().toString()) + " " + (d.getHours().toString().length == 2 ? d.getHours().toString() : "0" + d.getHours().toString()) + ":" + ((parseInt(d.getMinutes() / 5) * 5).toString().length == 2 ? (parseInt(d.getMinutes() / 5) * 5).toString() : "0" + (parseInt(d.getMinutes() / 5) * 5).toString()) + ":00";
		const notificationsfiltrees4 = notifications.filter(tmp => (tmp.originalDate + ' ' + tmp.originalTime > date_format_str));
		notifications = notificationsfiltrees4;

		// Filtre et ne garde que les enregistrements qui ont un status qui correspond à req.query.status
		if ((req.query.status != 'all') && (req.query.status != 'ALL')) {
			var FiltreSurStatus = 'ON';
			if ((req.query.status == 'off') || (req.query.status == 'OFF')) FiltreSurStatus = 'OFF';
			const notificationsfiltrees2 = notifications.filter(tmp => tmp.status == FiltreSurStatus);
			notifications = notificationsfiltrees2;
		}

		// Trie par Date/Heure
		const notificationsfiltrees3 = notifications.sort(function(a, b) {
			var x = a.originalDate + a.originalTime;
			var y = b.originalDate + b.originalTime;
			return ((x < y) ? -1 : ((x > y) ? 1 : 0));
		});
		notifications = notificationsfiltrees3;


		var compteurdePosition = 1;
		var compteurdePositionaTrouver = 1;
		var stringarenvoyer = 'none';
		if (req.query.position > 1) {
			compteurdePositionaTrouver = req.query.position;
		}

		for (var serial in notifications) {
			if (notifications.hasOwnProperty(serial)) {
				if (compteurdePositionaTrouver == compteurdePosition) {
					var device = notifications[serial];

					//C'est bon, on est sur la bonne position, on renvoie le résultat

					switch (req.query.format) {
						case 'hour':
						case 'HOUR':
							stringarenvoyer = device.originalTime.substring(0, 5);
							break;
						case 'full':
						case 'FULL':
							stringarenvoyer = device.originalDate + " " + device.originalTime;
							break;
						default: //ou HHMM
							stringarenvoyer = device.originalTime.substring(0, 5).replace(':', ''); // Utilisation du format HH:MM
					}
				}
				compteurdePosition++;
			}
		}
		res.status(200).json({
			value: stringarenvoyer
		});

	});
});

/***** WhenNextReminderLabel *****
  URL: /whennextreminderlabel

  Return le texte du prochain rappel
  [{
    position => 1= prochaine 2=suivante ...
	status => Filtre sur le status (active=ON, désactive=OFF, Tous =ALL)
  }]

*/
app.get('/whennextreminderlabel', (req, res) => {
	config.logger('Alexa-API: Lancement de '+req.path+' sur '+req.query.device, 'INFO');
	res.type('json');


	alexa.getNotifications2(function(notifications) {

		if (isEmpty(notifications))
			return res.status(500).json(error(500, req.route.path, 'Alexa.whennextreminder', 'Retour vide'));

		// Filtre et ne garde que les enregistrements du device selctionné
		const notificationsfiltrees = notifications.filter(tmp => tmp.deviceSerialNumber == req.query.device);
		notifications = notificationsfiltrees;

		// Filtre et ne garde que les enregistrements qui ont le type ALARM
		const notificationsfiltrees1 = notifications.filter(tmp => tmp.type == "Reminder");
		notifications = notificationsfiltrees1;


		// Filtre et ne garde que les enregistrements qui sont supérieure à l'heure du jour
		//Maintenant :
		var d = new Date();
		var date_format_str = d.getFullYear().toString() + "-" + ((d.getMonth() + 1).toString().length == 2 ? (d.getMonth() + 1).toString() : "0" + (d.getMonth() + 1).toString()) + "-" + (d.getDate().toString().length == 2 ? d.getDate().toString() : "0" + d.getDate().toString()) + " " + (d.getHours().toString().length == 2 ? d.getHours().toString() : "0" + d.getHours().toString()) + ":" + ((parseInt(d.getMinutes() / 5) * 5).toString().length == 2 ? (parseInt(d.getMinutes() / 5) * 5).toString() : "0" + (parseInt(d.getMinutes() / 5) * 5).toString()) + ":00";
		const notificationsfiltrees4 = notifications.filter(tmp => (tmp.originalDate + ' ' + tmp.originalTime > date_format_str));
		notifications = notificationsfiltrees4;

		// Filtre et ne garde que les enregistrements qui ont un status qui correspond à req.query.status
		if ((req.query.status != 'all') && (req.query.status != 'ALL')) {
			var FiltreSurStatus = 'ON';
			if ((req.query.status == 'off') || (req.query.status == 'OFF')) FiltreSurStatus = 'OFF';
			const notificationsfiltrees2 = notifications.filter(tmp => tmp.status == FiltreSurStatus);
			notifications = notificationsfiltrees2;
		}

		// Trie par Date/Heure
		const notificationsfiltrees3 = notifications.sort(function(a, b) {
			var x = a.originalDate + a.originalTime;
			var y = b.originalDate + b.originalTime;
			return ((x < y) ? -1 : ((x > y) ? 1 : 0));
		});
		notifications = notificationsfiltrees3;


		var compteurdePosition = 1;
		var compteurdePositionaTrouver = 1;
		var stringarenvoyer = 'none';
		if (req.query.position > 1) {
			compteurdePositionaTrouver = req.query.position;
		}

		for (var serial in notifications) {
			if (notifications.hasOwnProperty(serial)) {
				if (compteurdePositionaTrouver == compteurdePosition) {
					var device = notifications[serial];
					stringarenvoyer=device.reminderLabel;
					//C'est bon, on est sur la bonne position, on renvoie le résultat
/*
					switch (req.query.format) {
						case 'hour':
						case 'HOUR':
							stringarenvoyer = device.originalTime.substring(0, 5);
							break;
						case 'full':
						case 'FULL':
							stringarenvoyer = device.originalDate + " " + device.originalTime;
							break;
						default: //ou HHMM
							stringarenvoyer = device.originalTime.substring(0, 5).replace(':', ''); // Utilisation du format HH:MM
					}*/
				}
				compteurdePosition++;
			}
		}
		res.status(200).json({
			value: stringarenvoyer
		});

	});
});

/***** Stop the server *****/
app.get('/stop', (req, res) => {
	config.logger('Alexa-API: Shuting down');
	res.status(200).json({});
	server.close(() => {
		process.exit(0);
	});
});


/***** Restart server *****/
app.get('/restart', (req, res) => {
	config.logger('Alexa-API: Restart');
	res.status(200).json({});
		config.logger('Alexa-API: ******************************************************************');
		config.logger('Alexa-API: *****************************Relance forcée du Serveur*************');
		config.logger('Alexa-API: ******************************************************************');
	startServer();
	
});

/* Main */
fs.readFile(config.cookieLocation, 'utf8', (err, data) => {
	if (err) {
		config.logger('Alexa-API: Error while loading the file: ' + config.cookieLocation);
		config.logger('Alexa-API: ' + err);
		process.exit(-1);
	}


	try {
	config.cookie = JSON.parse(data);
	} catch (err) {
		config.logger('Alexa-API: Si vous voyez ce message, relancez la génération du COOKIE AMAZON, il y a un souci dessus');
		config.logger('Alexa-API: ' + err);
	}
	startServer();

});

function startServer() {

	if ((Date.now()-dernierStartServeur)>20000)
	{
		dernierStartServeur=Date.now();
		alexa = null;
		alexa = new Alexa();
		config.logger('Alexa-API:    ******************** Lancement Serveur ***********************','INFO');
		
		alexa.init({
				cookie: config.cookie,
				logger: config.logger,
				alexaServiceHost: config.alexaServiceHost,
				cookieRefreshInterval: config.cookieRefreshInterval,
				useWsMqtt: config.useWsMqtt
			},
			(err) => {
				// Unable to init alexa
				if (err) {
					config.logger('Alexa-API:    Error while initializing alexa');
					config.logger('Alexa-API:    ' + err);
					process.exit(-1);
				}

				if (alexa.cookieData) {
					fs.writeFile(config.cookieLocation, JSON.stringify(alexa.cookieData), 'utf8', (err) => {
						if (err) {
							config.logger('Alexa-API:    Error while saving the cookie to: ' + config.cookieLocation);
							config.logger('Alexa-API:    ' + err);
						}
						config.logger('Alexa-API:    New cookie saved to:' + config.cookieLocation,'DEBUG');

						// Start the server
						if (server) {
							config.logger('Alexa-API:    *******************************************','INFO');
							config.logger('Alexa-API:    *Server is already listening on port ' + server.address().port + ' *','INFO');
							config.logger('Alexa-API:    *******************************************','INFO');
						} else {
							server = app.listen(config.listeningPort, () => {
								config.logger('Alexa-API:    **************************************************************','INFO');
								config.logger('Alexa-API:    ************** Server OK listening on port ' + server.address().port + ' **************','INFO');
								config.logger('Alexa-API:    **************************************************************','INFO');

							});
						}
						//AllerVoirSilYaDesCommandesenFileAttente();
					});
				}
			});
	}
	else
	{
	config.logger('Alexa-API:    ******************** Lancement Serveur annulé (dernière relance trop récente)***********************');
	}
}

//alexa.sendSequenceCommand(serial, 'speak', req.query.text, GestionErreur);

//Gestion des erreurs et surtout pour détecter les ConnexionClose

function traiteErreur(err, commandesEnErreur=null, queryEnErreur=null) {
		
	
if (err)
{
		//config.logger('Alexa-API: ******************************************************************');
		//config.logger('Alexa-API: *****************************ERROR********************************');
		//config.logger('Alexa-API: ******************************************************************');

		if (err.message == "Connexion Close") {
			config.logger("Alexa-API: Connexion Close détectée et donc relance du lien au serveur Amazon", 'WARNING');
			startServer();
		}
		else if (err.message == "Unauthorized") {
			config.logger("Alexa-API: Unauthorized détecté et donc relance du lien au serveur Amazon", 'WARNING');
			startServer();
		}		
		//else
		//{
		if (Array.isArray(commandesEnErreur)) {
		config.logger("Alexa-API: "+err+" Commands: "+JSON.stringify(commandesEnErreur)+" Query: "+JSON.stringify(queryEnErreur), 'ERROR');
			if (!(queryEnErreur['replay'])) { // si c'est pas défini c'est que c'est le premier essai, donc on rejoue
					var listeCommandesEnErreur=[];
					listeCommandesEnErreur.push(commandesEnErreur);
					httpPost('commandesEnErreur', {
										queryEnErreur: queryEnErreur,
										listeCommandesEnErreur: commandesEnErreur
									});
				config.logger("Alexa-API: "+commandesEnErreur.length+" commandes en erreur: "+JSON.stringify(commandesEnErreur)+" query: "+JSON.stringify(queryEnErreur), 'WARNING');
			}
		}
		else if (typeof (commandesEnErreur) == "string") {
		config.logger("Alexa-API: "+err+" Command: "+commandesEnErreur+" Query: "+JSON.stringify(queryEnErreur), 'ERROR');
			if (!(queryEnErreur['replay'])) { // si c'est pas défini c'est que c'est le premier essai, donc on rejoue
					httpPost('commandesEnErreur', {
										queryEnErreur: queryEnErreur,
										listeCommandesEnErreur: commandesEnErreur
									});
				config.logger("Alexa-API: commande en erreur: "+commandesEnErreur+" query: "+JSON.stringify(queryEnErreur), 'WARNING');
			}
		}	
		//config.logger('Alexa-API: ******************************************************************');
		//config.logger('Alexa-API: ******************************************************************');
		//}
		
		
		
}		

		
}

function httpPost(nom, jsonaenvoyer) {

//config.logger && config.logger('httpPost httpPost httpPost httpPost httpPost httpPost httpPost httpPost httpPost httpPost httpPost '+nom);
var url=IPJeedom+"/plugins/alexaapi/core/php/jeeAlexaapi.php?apikey="+ClePlugin+"&nom="+nom;
	
config.logger && config.logger('URL envoyée: '+url, "DEBUG");
 
jsonaenvoyer=JSON.stringify(jsonaenvoyer);
config.logger && config.logger('DATA envoyé:'+jsonaenvoyer,'DEBUG');

	request.post(url, {

			json : true,
			gzip : false,
			multipart: [
				  {
					body: jsonaenvoyer
				  }
				]
		}, function (err, response, json) {

			if (!err && response.statusCode == 200) {
					//if(!json.result && json.error)
					//{
				//		//error json.error
				//	}
				//	else {
				//		//json.result;
				//	}
				} else 
				{
					//error err est une erreur html
				}
			});
 /**/
    }
		//  config.logger(JSON.stringify(devices));


function error(status, source, title, detail) {
	let error = {
		'status': status,
		'title': title,
		'detail': detail
	};

	config.logger('Alexa-API: ' + title + ': ' + detail);
	return error;
}
