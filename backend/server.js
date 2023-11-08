const express = require('express');
const app = express();


const bodyParser = require('body-parser');
app.use(bodyParser.json());

var mysql = require('mysql');

const bcrypt = require('bcrypt');

const session = require('express-session');

const cors = require("cors");

const path = require('path');
const pathInscription = path.join(__dirname,'..','pages', '/inscription.js');
//const pathConnexion = path.join(__dirname,'..','pages', 'connexion.js');
const pathAccueil = path.join(__dirname,'..','App.js');


//pour allow la request origin port 3000 à 3002
//origin: ["http://localhost:3000","http://localhost:3001","http://localhost:3002","http://tp2-app-web-af-pm.vercel.app","http://tp2-app-web-af-pm.vercel.app","http://tp2-app-web-af-pm.vercel.app/connexion","http://tp2-app-web-af-pm.vercel.app/inscription","http://tp2-app-web-af-pm.vercel.app/","http://tp2-app-web-af-pm.vercel.app/calendrier"],
   // methods: ["GET", "POST","DELETE","PUT"],
    //credentials: true,
app.use(
  cors({
    origin: ["http://localhost:3000","http://localhost:3001","http://localhost:3002","https://tp2-app-web-af-pm.vercel.app"],
    methods: 'GET,POST,PUT,DELETE', 
    //allowedHeaders: 'Content-Type,Authorization',
    credentials: true,
  })
);

// gestion de session
const oneDay = 1000 * 60 * 60 * 24;
app.use(session({
    secret: "thisismysecrctekek34321",
    saveUninitialized:true,
    resave: false 
}));

//connection
//pool de connection permet d'avoir plusieurs connections et les réutiliser
var connPool = mysql.createPool({
    connectionLimit: 15,
    database: 'defaultdb',
    host: "tp2-database-cegeplimoilou-d98e.aivencloud.com",
    user: "tp2-user",
    password: "AVNS_Lr1bNoaKr9acqJQ-2Yx",
    port : "13923"
});

//requete et connection pour aller chercher l'utilisateur selon les paramètres
function requeteSelectUser(username,password,callback){  //operation dans le callback
    console.log(username + " "+password);
    //connection et requete
    connPool.getConnection((err,conn)=> {
        if (err) throw err;
        console.log("Connected");
    
        var sqlQuery = "SELECT * FROM defaultdb.Utilisateur u WHERE u.user_name = ?";
        conn.query(sqlQuery,[username, password],(err, rows, fields)=>{
            if (err){
                callback(null,bcryptErr);
            };
            if(rows.length>0){
                data = rows;
                const user = rows[0];
                const hashedPassword = user.user_password; 
            
            console.log(password +" "+hashedPassword)
            bcrypt.compare(password, hashedPassword, (bcryptErr, result) => {
                if(bcryptErr){
                    console.log("bcrypt error")
                    callback(null,null);
                }
                if (!result) {
                    console.log("invalide username password")
                    callback(null,null);
                }
                else{
                    console.log("valide ")
                    console.log(user)
                    callback(user,null );
                }
                conn.release();
            })
            }else{
                callback(null,null);
            }
    });
})
}

//function generate un token la longeur du token est passé en paramètre
function generateToken(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';
  
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomString += characters.charAt(randomIndex);
    }
  
    return randomString;
}

//API'S--------------------------------------

// Accueil
app.get("/", (req, res) => {
    const messageBienvenue = "<h1>Bienvenue sur la page d'accueil de votre calendrier.</h1>";
    res.send(messageBienvenue);
    res.sendFile(pathAccueil);
});

app.post("/api/inscription", (req, res) => {
    const { username, password } = req.body;

    // verifie d'abord si l'utilisateur existe déjà
    const checkUserQuery = "SELECT id_utilisateur FROM defaultdb.Utilisateur WHERE user_name = ?";
    connPool.query(checkUserQuery, [username], (err, userRows, userFields) => {
        if (err) {
            console.error("Erreur lors de la vérification de l'existence de l'utilisateur", err);
            return res.redirect("/inscription");
        }

        if (userRows.length > 0) {
            console.error("Cet utilisateur existe déjà");
            return res.redirect("/inscription");
        }

        // Si l'utilisateur n'existe pas, ajout à la base de données
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                console.error("Erreur de hachage de mot de passe");
                return res.redirect("/inscription");
            } else {
                // Insère le nouvel utilisateur
                const sqlQuery = "INSERT INTO defaultdb.Utilisateur (user_name, user_password) VALUES (?, ?)";
                connPool.query(sqlQuery, [username, hash], (err, result) => {
                    if (err) {
                        console.error("Erreur lors de l'insertion de l'utilisateur dans la base de données", err);
                        return res.redirect("/inscription");
                    } else {
                        console.error("Reussi");
                        res.sendStatus(200).end();
                    }
                });
            }
        });
    });
});


//validation de connexion utilisateur
app.post("/api/connexion",(req,res)=>{
    console.log(req.body)
    const { username, password } = req.body;
    // avec requeteSelectUser
    requeteSelectUser(username,password, (data, err) => {
        if (data==null) {
            console.error("erreur de connection");
            res.send('Erreur de connection').end();}
        else{
            console.error("connection succes");

            //set le token associé à cette connexion
            let token = generateToken(10);
            req.session.token = token;
            

            //temps alloué à la session
            req.session.cookie.originalMaxAge = 999999;

            //associe id utilisateur à la session
            req.session.user_id = data.id_utilisateur;

            //save session
            req.session.save((err) => {
                if (err) {
                  console.error('Error saving session:', err);
                  res.send('Session not saved').end();
                } else {          
                    console.error("Succes creation session");   
                  res.send({"token":token}).end();
                }
              });
        }
    });
});

//valide que la session user contient bien un token valide
app.get("/api/getToken",(req,res)=>{
    console.log("comparetoken : "+"clientside : "+req.query.token+" serverside : "+req.session.token);
    if(req.session.token!==undefined){
        if(req.query.token==req.session.token){
            res.send({"isConnected":true}).end();
        }
        else{
            console.log(req.sessionStore)
            console.log(req.sessionID)
            res.send({"isConnected":false}).end();
        }
    }
    else{
        res.send({"isConnected":false,"servertoken":req.session.token,"tokenClient":req.query.token,"obj":req.sessionID,"sessionid":req.sessionID,"store":req.sessionStore}).end();
    }
})


// détruit la session de l'utilisateur
app.get("/deconnexion", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Erreur lors de la déconnexion");
        }
        console.log("session detruite")
        res.redirect("/");
    });
});

//créer un évenement en bd
app.post("/api/createEvent",(req,res)=>{
    console.log("call createevent")
    console.log(req.body);
    console.log(req.session);
    const { titre,date} = req.body;
    const idUser = req.session.user_id;

    if (req.session.user_id!==undefined && req.session.token !== undefined) {

        let insertQuery = "INSERT INTO defaultdb.CalendrierEvents(titre_event,date_event,fk_id_user)VALUES( ? , ? , ? );";
        connPool.query(insertQuery, [titre,date,idUser], (err, result) => {
            if (err) {
                console.error("Erreur lors de l'insertion de l'event calendrier", err);
                res.status(200).send({"message":"Erreur lors de l'insertion de l'event calendrier en db"}).end();
            } else {
                console.error("Event insert réussi");
                res.status(200).send({"message":"Evenement créé avec succes"}).end();
            }
        })
    }else{
        res.status(400).send({"message":"Erreur not connected"}).end();
    }    
})

//effacer l'évenement entrer par l'utilisateur
app.delete("/api/deleteEvent",(req,res)=>{
    console.log(req.query.title);
    let title = req.query.title;
    let date = req.query.date;

    let deleteQuery = "delete from defaultdb.CalendrierEvents where titre_event = ? and date_event = ? and fk_id_user = ?";
    if (req.session.user_id!==undefined && req.session.token !== undefined) {
        connPool.query(deleteQuery,[title,date,req.session.user_id],(err,result)=>{
            if (err) {
                console.error("Erreur lors du delete de l'event", err);
                res.send({"message":"Erreur lors du delete de l'event"}).end();
            } else {
                console.error("Event delete réussi");
                res.send({"message":"Evenement delete avec succes"}).end();
            }
        })
    }else{
        res.status(400).send({"message":"Erreur not connected"}).end();
    }

});

// retourne tous les évenements du calendrier associé à l'utilisateur en session
app.get("/api/getEvents", (req, res) => {
    // controller si l'utilisateur est connecté grace session
    let userId = req.session.user_id;
    if (req.session.user_id!==undefined && req.session.token !== undefined) {
        let selectQuery = "select * from defaultdb.CalendrierEvents where fk_id_user = ?";
        connPool.query(selectQuery, [userId], (err, result) => {
            if (err) {
                console.error("Erreur lors de la lecture de la bd", err);
                res.send({"message":"Erreur lors de la lecture en bd"}).end();
            } else {
                let dataArray = [];
                for(let event of result){
                    const eventDate = new Date(event.date_event);
                    const formattedDate = eventDate.toLocaleDateString();
                    dataArray.push({"title":event.titre_event,"date":formattedDate})
                }

                dataArray.push({title: 'Début du TP1', date: '2023-10-13'});
                dataArray.push({title: 'Fin du TP1', date: '2023-11-10'});
                //console.log(dataArray)
                res.send({"array":dataArray}).end();
            }
        })
    } else {
        console.log("Peut retourner d'event parce que il n'y a pas de session associé à l'appeleur")
        res.status(400).send("").end();
    }
});

//ecoute sur le port 5000
app.listen(5000 ,()=>{
    console.log("server listening on port 5000")
});
