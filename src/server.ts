console.log(`\x1b[0m`); // Resetting the console
import Fastify from 'fastify';
import cors from '@fastify/cors';
import axios from 'axios';
import { init_db, insertDataIntoTable, readDataFromTable } from './database';
import { string } from 'yaml/dist/schema/common/string';
import { get_token_schema, query_options_schema, user_info_schema } from './vaild_schema';
import { generate_hash_password, generate_salt, generate_session_key, generate_uuid } from './authen_tools';
const moment = require('moment-timezone');

const redis = require('redis');
const redisClient = redis.createClient();
function init_redis() {
    redisClient.on('connect', () => console.log('Redis Client \x1b[32m Connected \x1b[0m'));
    redisClient.on('error', (err: string) => console.error('Redis Client Connection Error', err));
} (async () => {
    await redisClient.connect();
})();

// //********************************////

init_db();
init_redis();
const fastify = Fastify();
fastify.register(cors, { hook: 'preHandler' });
console.log(`Initial Server..`, `\x1b[32m Done \x1b[0m`);
// @ API
fastify.get('/', (req, reply) => {
    reply.send({ hello: 'world' })
});

fastify.get('/redis', async (req, reply) => {
    const query: any = req.query;
    const username: string = query.username;
    const data: string = await redisClient.get(username);
    if (data == null || data == "") {
        console.log(`no Data new fetch`);
        const BASE_URL: string = 'https://api.github.com/users';
        const url: string = `${BASE_URL}/${username}`;
        const response: any = await axios.get(url);
        redisClient.SETEX(username, 60, JSON.stringify(response.data));
        reply.send(response.data);
    }
    if (data) {
        console.log(`has Data `, data);
        return reply.send(JSON.parse(data));
    }
});

fastify.get('/auto_read_registers', {}, async (request, reply) => {
    try {
        const options = request.query;
        const result = await readDataFromTable('tb_auto_read_registers', options);
        reply.code(result.statusCode).send(result.body);
    } catch (error: any) {
        reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
});

fastify.post('/auto_read_registers', {}, async (request, reply) => {

    /**
    {
        "device_id":"9988776655",
        "variable_name":"test",
        "variable_unit_name":"unit",
        "variable_multiply":0.01,
        "slaves_id":1,
        "data_address":1,
        "data_length":2,
        "mode":"rtu"
    }
    */
    try {
        const insertData: any = request.body;
        await insertDataIntoTable('tb_user_info', insertData, true);
        reply.code(200).send({ message: 'Data inserted successfully' });
    } catch (error: any) {
        reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
});


fastify.post('/user_info', {}, async (request, reply) => { /**
        {
            "username":"admin",
            "password_hash":"password",
            "name":"admin",
            "last_name":"cpl",
            "phone" :"",
            "email" :"",
            "avatar":"",
            "role" :"-1",
            "in_used":"true",
            "company_id" :"0"
        }
        try {
            const insertData: any = request.body;
            await insertDataIntoTable('tb_user_info', insertData, true);
            reply.code(200).send({message: 'Data inserted successfully'});
        } catch (error : any) {
            reply.code(500).send({error: 'Internal server error', message: error.message});
        }
          */
    const incomingData: user_info_schema = request.body as user_info_schema;
    let salt = generate_salt();
    let password_hash = generate_hash_password(incomingData.password_hash, salt);
    let reply_json = {
        "salt": salt,
        "password_hash": password_hash
    };

    reply.code(200).send({ req_body: reply_json });
});


fastify.post('/get_token', {}, async (request, reply) => {

    /**
            {
                "username":"admin",
                "password_hash":"8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", 
                "email" :"admin@creativepowerthai.com"
            } 
*/
    try {
        const postData: get_token_schema = request.body as get_token_schema;
        let options = {
            transform: '1',
            filter: `username,eq,${postData.username
                }`
        };
        if (postData.username == "") {
            options = {
                transform: '1',
                filter: `email,eq,${postData.email
                    }`
            };
        }
        const result = await readDataFromTable('tb_user_info', options);
        console.log(result);
        const salt = result.body[0].password_salt;
        const password_hash = result.body[0].password_hash;
        const hash_password = generate_hash_password(postData.password_hash, salt);
        console.log(hash_password, password_hash);
        if (hash_password == password_hash) {
            const session_key = generate_session_key();
            const device_uuid = generate_uuid();
            const timestamp = moment().tz("Asia/Bangkok").format();
            reply.code(result.statusCode).send({ message: 'success', session_key: session_key, uuid: device_uuid, timestamp: timestamp, ip: request.ip });

        } else {
            reply.code(401).send({ message: 'Check your username, email or password' });
        }
    } catch (error: any) {
        reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
});

fastify.get('/table/:tableName', {}, async (request, reply) => {
    try {
        const params: any = request.params;
        const tableName = params['tableName'] as string;
        const options = request.query;
        console.log(options);
        const result = await readDataFromTable(tableName, options); // Use the extracted tableName
        reply.code(result.statusCode).send(result.body);
    } catch (error: any) {
        let errorMessage = "Failed to do something exceptional";
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        reply.code(500).send({ error: 'Internal server error', message: errorMessage });
    }
});

fastify.post('/table/:tableName', {}, async (request, reply) => {
    try {
        const params: any = request.params;
        const tableName = params['tableName'] as string;
        const insertData: any = request.body;
        await insertDataIntoTable(tableName, insertData, true);
        reply.code(200).send({ message: 'Data inserted successfully' });
    } catch (error: any) {
        reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
});

fastify.post('/', (request, reply) => {
    reply.send({ "heey": "see" });
});

const port = 3000;
fastify.listen({
    port: port
}, err => {
    if (err)
        throw err;



    console.log(`Server is Listening on `, `\x1b[32mhttp://localhost:${port} \x1b[0m`);
});
