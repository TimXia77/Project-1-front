
//Requires
const express = require("express");
const app = express();

var path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
var cookieParser = require("cookie-parser");
const bodyParser = require('body-parser'); //parse body of post req
require('dotenv').config();

app.set("view engine", "ejs");

//Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use(cookieParser());
app.use(express.static(__dirname + "/../../front-end"));
app.use(express.json());

//Data access layer
const dataLayer = require("../data.js");

//Helper Modules
const authHelper = require("./authHelper.js")(app);
const cache = require("./cache.js");
const { constants } = require("buffer");

//Constants (for readability)
const registerPage = ["/", "/register"];
const PORT = 3000;

//Data that is off limits (used for testing) / Code to aid testing:
dataLayer.deleteUser('newUserTest');

//API Specification:
const swaggerDocument = YAML.load('./apiSpecification.yaml');

const swaggerOptions = {
    swaggerDefinition: swaggerDocument,
    apis: ['./server.js'],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


//Routes 


//dockerize front end

//create container with both (docker compose )

app.get('/test', async (req, res) => { 
    const response = await fetch(`http://frontend/login-en.html`);
    const html = await response.text();
    console.log("response: " + response);
    res.send(html);
});


app.get(registerPage, (req, res) => {
    res.sendFile(path.resolve('../../front-end/register-en.html'));
});

app.post(registerPage, async (req, res) => {
    if (!((req.body.email).includes("@"))) {        //Check if username, password, and email pass restrictions
        return res.status(400).redirect('/register?error=email');

    } else if (!(/^[a-zA-Z0-9_]{2,}$/.test(req.body.username))) {
        return res.status(400).redirect('/register?error=username');

    } else if (!(/[0-9]/.test(req.body.password) && /[A-Z]/.test(req.body.password) && /[a-z]/.test(req.body.password) && (req.body.password).length >= 8)) {
        return res.status(400).redirect('/register?error=password');

    }


    const dataArr = dataLayer.readUsers(); //array with user information

    const usernameUser = dataArr.find(findUser => findUser.username === req.body.username); //variables to determine if an account already exists.
    const emailUser = dataArr.find(findUser => findUser.email === req.body.email);

    if (usernameUser && emailUser) {     //Check if username, password, and email are not taken
        return res.status(409).redirect('/register?error=taken-user-email');

    } else if (emailUser) {
        return res.status(409).redirect('/register?error=taken-email');

    } else if (usernameUser) {
        return res.status(409).redirect('/register?error=taken-user');

    } else {
        try {   //valid information! Creating account

            await (dataLayer.addUser(req.body.email, req.body.username, req.body.password));
            const token = authHelper.createUserToken(req.body.username);
            res.cookie("token", token);

            return res.redirect(`/table?user=${req.body.username}`);

        } catch {
            res.status(500).send("Internal error occured when registering!");
        }
    }
});


app.get('/login', (req, res) => {
    res.sendFile(path.resolve('../../front-end/login-en.html'));
});

app.post("/login", (req, res) => {
    if (dataLayer.findUser(req.body.username, req.body.password)) {
        try {
            const token = authHelper.createUserToken(req.body.username);
            res.cookie("token", token);

            return res.redirect(`/table?user=${req.body.username}`); //status 200

        } catch {
            res.status(500).redirect('/login?error=internal');
        }
    } else {
        return res.status(401).redirect('/login?error=login');
    }

});

app.post('/logout', (req, res) => {
    if (req.cookies.token) {
        res.clearCookie("token");
        res.status(302).redirect("/login?logout=true");
    } else {
        res.status(405).send("Invalid JWT");
    }
});

//Data page 
//Inventory Management: When the table is updated, the cache should be updated.
app.post("/table", authHelper.cookieJwtAuth, cache(3600), (req, res) => {
    if (authHelper.authCookie(req.body.cookie)) {
        res.status(200).json(dataLayer.readTable());
    } else {
        res.status(405).json({ error: 'Authentication failed' });
    }
});

app.get("/table", authHelper.cookieJwtAuth, (req, res) => {
    // res.sendFile(__dirname + '/../static/index.html');
    res.sendFile(path.resolve('../../front-end/table.html'));

});


//Start the server
app.listen(PORT, () => {
    console.log(`\nRunning on port ${PORT}.`);
    console.log("Test this at: ");
    console.log(`http://localhost:${PORT}/register`);
    console.log(`http://localhost:${PORT}/login`);
    console.log(`http://localhost:${PORT}/table`);
    console.log("\nOr check out the specification:")
    console.log(`http://localhost:${PORT}/api-docs`);
});


//Start server for automated tests
function startServer(PORT) {
    app.listen(PORT, () => {
        console.log(`\nRunning on port parameter ${PORT}.`);
        console.log("Test this at: ");
        console.log(`http://localhost:${PORT}/register`);
        console.log(`http://localhost:${PORT}/login`);
        console.log(`http://localhost:${PORT}/table`);
        console.log("\nOr check out the specification:")
        console.log(`http://localhost:${PORT}/api-docs`);
    });

    return app;
};

module.exports = { startServer };
