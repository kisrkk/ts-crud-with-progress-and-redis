const schema_auto_read_registers = {
    body: {
        title: "schema_auto_read_registers",
        description: "schema_auto_read_registers",
        type: "object",
        properties: {
            id: {
                description: "id",
                type: "integer"
            },
            documents: {
                description: "Documents name list",
                type: "array",
                items: {
                    type: "string"
                },
                minItems: 2,
                uniqueItems: true
            }
        },
        required: ["id", "documents"]
    }
};


export {
    schema_auto_read_registers 
}

export interface query_options_schema {
    transform: string
    filter: string[]
    order:string
    page:string 
}
export interface get_token_schema {
    username: string
    email: string
    password_hash:string 
}
export interface user_info_schema {
    username: string
    password_hash: string
    name: string
    last_name: string
    phone: string
    email: string
    avatar: string
    role: string
    in_used: string
    company_id: string
}