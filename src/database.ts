import {Pool, QueryResult} from 'pg'; 
const fs = require('fs');
import { parse, stringify,YAMLSet } from 'yaml'
const {execSync} = require('child_process'); 
const file = fs.readFileSync('src/config.yaml', 'utf8')
const db_config = parse(file);
//console.log(db_config)
let pool = new Pool({
    user: db_config.database.username,
    password: db_config.database.password,
    host: db_config.database.host, 
    port: db_config.database.port 
    
});

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}


async function createDatabaseIfNotExists(): Promise<void> {
    try {
        let client = await pool.connect();
        await client.query('SELECT 1 FROM pg_database WHERE datname = $1', ['postgres']);

        let dbExistsResult = await client.query('SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)', ['postgres']);
        let dbExists = dbExistsResult.rows[0].exists;

        if (!dbExists) {
            console.log('Creating database...');
            await client.query('CREATE DATABASE postgres');
            console.log('Database created.');
        } 
        client.release();  
        pool = new Pool({
            user: db_config.database.username,
            password: db_config.database.password,
            host: db_config.database.host,
            database: db_config.db_name,
            port: db_config.database.port 
            
        });  
        
        console.log(`Initial database..`, `\x1b[32m OK \x1b[0m`);
    } catch (error) {
        console.log(`Initial database..`, `\x1b[31m Fail \x1b[0m`);
        throw new Error(`Error creating database: ${error}`);
    }
}

async function createTableIfNotExist(createTableQuery: string, debug: boolean = false): Promise<void> {
    try {
        if (debug) {
            console.log(createTableQuery);
        }
        const client = await pool.connect();
        await client.query(createTableQuery);
        client.release();
    } catch (error) {
        throw new Error(`Error initializing table: ${error}`);
    }
}

/**
 * The `initComponents` function initializes the components of the application, including creating a
 * database if it does not exist and setting up event listeners for the Redis client.
 */
async function init_db() {
    try{

   
    await createDatabaseIfNotExists();
    await createTableIfNotExist(`
    CREATE TABLE IF NOT EXISTS public.tb_user_info (
        id serial PRIMARY KEY,
        username varchar(25) NOT NULL,
        password_hash varchar(64) NOT NULL,
        password_salt varchar(32) NOT NULL,
        name varchar(25) NOT NULL,
        last_name varchar(25),
        phone varchar(14) NOT NULL,
        email varchar(50) NOT NULL,
        avatar varchar,
        role integer NOT NULL,
        in_used boolean NOT NULL DEFAULT false,
        company_id varchar NOT NULL,
        create_at timestamp  NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);
    await createTableIfNotExist(`
CREATE TABLE IF NOT EXISTS public.tb_company_info (
    id serial PRIMARY KEY, 
    create_at timestamp  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    company_id varchar NOT NULL,
    company_name varchar NOT NULL,
    company_address varchar NOT NULL,
    company_phone varchar NOT NULL,
    company_logo_path varchar NOT NULL
)
`);

    await createTableIfNotExist(`
CREATE TABLE IF NOT EXISTS public.tb_customer_info (
    id serial PRIMARY KEY, 
    create_at timestamp  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_id varchar NOT NULL,
    customer_name varchar NOT NULL,
    customer_address varchar NOT NULL,
    customer_phone varchar NOT NULL,
    customer_logo_path varchar NOT NULL 
)
`);
    await createTableIfNotExist(`
CREATE TABLE IF NOT EXISTS public.tb_downlink_registers (
    id serial PRIMARY KEY, 
    create_at timestamp  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    device_id varchar NOT NULL,
    variable_name varchar NOT NULL,
    variable_unit_name varchar NOT NULL,
    variable_multiply float NOT NULL,
    slaves_id integer NOT NULL,
    data_address integer NOT NULL,
    data_length integer NOT NULL,
    mode varchar NOT NULL
)
`);

    await createTableIfNotExist(`
CREATE TABLE IF NOT EXISTS public.tb_auto_read_registers (
    id serial PRIMARY KEY, 
    create_at timestamp  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    device_id varchar NOT NULL,
    variable_name varchar NOT NULL,
    variable_unit_name varchar NOT NULL,
    variable_multiply float NOT NULL,
    slaves_id integer NOT NULL,
    data_address integer NOT NULL,
    data_length integer NOT NULL,
    mode varchar NOT NULL
)
`);

    await createTableIfNotExist(`
CREATE TABLE IF NOT EXISTS public.tb_session_key (
    session_id serial PRIMARY KEY, 
    create_at timestamp  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id varchar NOT NULL,
    session_key varchar NOT NULL,
    expiration_time timestamp NOT NULL
)
`);
return true;
}
catch (error) {
    return false;
}
}


async function insertDataIntoTable(table_name: string, insert_object: JSON, debug: boolean = false): Promise<void> {
    try {
        const insertQuery = `
            INSERT INTO ${table_name} (${
            Object.keys(insert_object).join(', ')
        })
            VALUES (${
            Object.keys(insert_object).map((_, i) => `$${
                i + 1
            }`).join(', ')
        })
        `;
        const values = Object.values(insert_object);
        if (debug) {
            console.log(`Inserting data into table: ${table_name}`);
            console.log(`SQL: ${insertQuery}`, `values`, values);
        }
        const client = await pool.connect();
        await client.query(insertQuery, values);
        client.release();
    } catch (error) {
        throw new Error(`Error inserting data into table: ${error}`);
    }
}


function buildQuery(tableName: string, option: any,debug:boolean = false): string {
    // Construct your PostgreSQL query here based on the provided options
    // Note: You should properly sanitize and validate user inputs to prevent SQL injection

    let query = `SELECT * FROM ${tableName}`;

    // Add WHERE clause based on filters
    if (option.filter) {
        
        const filters = Array.isArray(option.filter) ? option.filter : [option.filter];
        const filterConditions: string[] = []; 
        filters.forEach((filter: { split: (arg0: string) => [any, any, any]; }) => {
            const [column, command, value] = filter.split(',');
            switch (command) {
                case 'cs': // Contains (case-insensitive) - PostgreSQL ILIKE
                    filterConditions.push(`${column} ILIKE '${value}'`);
                    break;
                case 'sw': // Starts with (case-insensitive) - PostgreSQL ILIKE
                    filterConditions.push(`${column} ILIKE '${value}'`);
                    break;
                case 'ew': // Ends with (case-insensitive) - PostgreSQL ILIKE
                    filterConditions.push(`${column} ILIKE '${value}'`);
                    break;
                case 'eq': // Equal - PostgreSQL =
                    filterConditions.push(`${column} = '${value}'`);
                    break;
                case 'ne': // Not equal - PostgreSQL !=
                    filterConditions.push(`${column} != '${value}'`);
                    break;
                case 'lt': // Less than - PostgreSQL <
                    filterConditions.push(`${column} < '${value}'`);
                    break;
                case 'le': // Less than or equal - PostgreSQL <=
                    filterConditions.push(`${column} <= '${value}'`);
                    break;
                case 'ge': // Greater than or equal - PostgreSQL >=
                    filterConditions.push(`${column} >= '${value}'`);
                    break;
                case 'gt': // Greater than - PostgreSQL >
                    filterConditions.push(`${column} > '${value}'`);
                    break;
                case 'in': // In - PostgreSQL IN
                    const valuesArray = value.split(',').map(() => `'${value}'`);
                    filterConditions.push(`${column} IN (${valuesArray.join(', ')})`);
                    break;
                case 'ni': // Not in - PostgreSQL NOT IN
                    const notInValuesArray = value.split(',').map(() => `'${value}'`);
                    filterConditions.push(`${column} NOT IN (${notInValuesArray.join(', ')})`);
                    break;
                case 'is': // Is null - PostgreSQL IS NULL
                    filterConditions.push(`${column} IS NULL`);
                    break;
                case 'no': // Is not null - PostgreSQL IS NOT NULL
                    filterConditions.push(`${column} IS NOT NULL`);
                    break;
                default:
                    break;
            }
        });
    
        const filterQuery = filterConditions.join(' AND ');
        // Use filterQuery in your SQL query to filter the results
        query += ` WHERE ${filterQuery}`;
    }
    
    // Add ORDER BY clause based on order
    if (option.order) {
        const [objKey, order] = option.order.split(',');
        query += ` ORDER BY ${objKey} ${
            order === 'asc' ? 'ASC' : 'DESC'
        }`;
    }

    // Add LIMIT and OFFSET for pagination
    if (option.page) {
        const [currentPage, recordsPerPage] = option.page.split(',').map(Number);
        const offset = (currentPage - 1) * recordsPerPage;
        query += ` LIMIT ${recordsPerPage} OFFSET ${offset}`;
    } 
    if(debug){
        console.log(query);
    }
    return query;
}


async function readDataFromTable(table_name: string, filter_options: any, debug: boolean = false): Promise<{ statusCode: number; body: any }> {
    let result: any = {};
    try { 
        const client = await pool.connect();
        const query = buildQuery(table_name, filter_options);
        const {rows} = await client.query(query);
        await client.release();

        if (filter_options.transform !== '1') {
            result = {
                [table_name]: {
                    columns: [],
                    records: []
                }
            };

            if (rows.length > 0) {
                result[table_name].columns = Object.keys(rows[0]);
            }

            rows.forEach((record) => {
                result[table_name].records.push(Object.values(record));
            });
        } else {
            result = rows;
        }
        console.error(query);
        return {statusCode: 200, body: result};
    } catch (err) {
        console.error(err);
        return {statusCode: 500, body: result};
    } finally {
        //await pool.end();
    }
}


export {
    createDatabaseIfNotExists,
    createTableIfNotExist,
    init_db,
    insertDataIntoTable,
    readDataFromTable
}
