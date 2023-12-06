import {ShaTS} from 'sha256-ts';
import {Md5} from 'ts-md5';
import {init_db, insertDataIntoTable, readDataFromTable} from './database';


/**
 * The function password_hash takes a password as input, generates a salt using MD5 hashing, and then
 * hashes the password and salt using SHA256 hashing.
 * @param {string} password - The `password` parameter is a string that represents the user's password.
 * @returns a hashed version of the password.
 */

function generate_salt(): string {
    return Md5.hashStr(Date.now().toString()).toString();
}

function generate_hash_password(password : string,salt : string): string { 
    //console.log('rawpassword',password, salt);
    return ShaTS.sha256(`${password}:${salt}`).toString();
}

function generate_session_key(): string {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 128; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        result += charset.charAt(randomIndex);
    }
    return "az"+result+'==';
}

function generate_uuid(): string {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return(c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

    return uuid;
}

type candidate = {
    username: string,
    email: string,
    password_str: string
}

async function check_user(candidate_value : candidate) {
    console.log(candidate_value);
    const result = await readDataFromTable('tb_user_info', {
            filter: `username,eq,${
            candidate_value.username
        }`
    });
    console.log(result);
}


//console.log(generate_salt());
/*
console.log(generate_hash_password('admin'));
console.log(generate_random_key());
console.log(generate_uuid());
*/

//8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918 : admin

export {
    generate_hash_password, 
    generate_session_key,
    generate_salt,
    generate_uuid,
}