import dotenv from 'dotenv'
dotenv.config()


export const URL_MONGO = process.env.URL_MONGO
export const SECRET_SESSION_MONGO = process.env.SECRET_SESSION_MONGO
export const PORT = process.env.PORT