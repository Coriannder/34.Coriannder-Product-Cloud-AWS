
import express from 'express'
import { Server as HttpServer }  from 'http'
import { Server as IOServer } from 'socket.io'
import { productosDao , mensajesDao , usuariosDao } from './daos/index.js'
import { ContenedorMemoria } from './container/ContenedorMemoria.js'
//import { createManyProducts } from './mocks/productosMocks.js'
import { webAuth, apiAuth } from '../src/auth/index.js'
import { SECRET_SESSION_MONGO, URL_MONGO, PORT } from './config/config.js'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import { createHash , isValidPassword } from './utils/crypt.js'
import cluster from 'cluster'
import { cpus } from 'os'
const numCPUs = cpus().length;
import compression from 'compression'
//import {logger} from './logger/index.js'

const app = express()
const httpServer = new HttpServer(app)
const io = new IOServer(httpServer)

app.use(express.json())
app.use(express.urlencoded({extended: true}))

//------------------Configuracion EJS---------------------------------//
app.set('views', './views')
app.set('view engine', 'ejs')


const urlmongo = process.env.URL_MONGO
const secretsessionmongo = process.env.SECRET_SESSION_MONGO
//-----------------Configuracion Session-------------------------------//
const advancedOptions = { useNewUrlParser: true , useUnifiedTopology: true}
app.use(session({
    // store: MongoStore.create({ mongoUrl: config.mongoLocal.cnxStr }),
    store: MongoStore.create(
        {
            mongoUrl: urlmongo, //URL_MONGO,
            mongoOptions: advancedOptions
        }),
    secret: secretsessionmongo, //SECRET_SESSION_MONGO,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: 6000
    }
}))

app.use(passport.initialize())
app.use(passport.session())



//------------------------PASSPORT----------------------------------//
import passport from 'passport'
import  { Strategy as LocalStrategy } from 'passport-local'
import { noBloqueante } from './routes/no-bloqueante.js'

passport.use('login' , new LocalStrategy( async ( username , password , done) => {

    const usuarios = await usuariosDao.listarAll()
    if( usuarios === false ) done( Error('error') )
    const user = usuarios.find(usuario => usuario.email === username)
    if( !user) {
         done(null, false)
    }else{
        isValidPassword(password , user.password) ? done(null, user) : done(null, false)
    }}))

passport.serializeUser(( user, done ) => {
    done(null, user.id)
})

passport.deserializeUser( async (id, done) => {
    done(null, await usuariosDao.listar(id))
})

//------------------------------RUTAS---------------------//
let subtitleLogin
let ruta = 'login'
let error

app.use((req, res, next) => {
    const {url, method} = req
    //logger.info(`Ruta recibida: ${url} - con metodo: ${method}`)
    next()
})
app.get('/info', (req, res) => {
    const processInfo = {
        platform: process.platform,
        version: process.version,
        title: process.title,
        execPath: process.execPath,
        processId: process.pid,
        rss: process.memoryUsage().rss,
        numberOfProcessors: numCPUs
    };
    //console.log(processInfo);
    res.send(`Estas en el puerto ${port}`)
})

app.get('/infozip' , compression() , (req, res) => {

    res.send(`Estas en el puerto ${port}`)
})

app.use('/api/randoms', noBloqueante)


app.get('/login' ,  (req, res) => {
    res.render('pages/login', {subtitleLogin: subtitleLogin})
})

app.post('/login', (req , res , next) => {
        ruta = 'login'
        error = 'error de logueo'
        next()
    },  passport.authenticate('login', {
        successRedirect: '/index',
        failureRedirect: '/error'
    }))


app.get('/index', async (req, res) => {
    if(req.isAuthenticated()){
        const email = (await usuariosDao.listar(req.session.passport.user))[0].email
        res.render('pages/index',{nombre: email})
        console.log((await usuariosDao.listar(req.session.passport.user))[0])
    } else {
        res.redirect('/login' )
    }
    
})

app.get('/logout', (req, res) => {
    console.log('Estas en ruta /logout')
    res.render('pages/logout', { nombre : req.session.nombre})
    req.session.destroy()
})

app.get('/register', (req, res) => {
    console.log('Estas en ruta /register')
    res.render('pages/register')
})


app.post('/register', async(req, res) => {
    const usuarios = await usuariosDao.listarAll()
    const email = req.body.email
    const password = createHash(req.body.password)
    if(usuarios.find(usuario => usuario.email == email)){
        ruta = '/register'
        error = "email ya registrado por otro usuario"
        res.redirect('/error')
    } else {
        await usuariosDao.guardar( {email: email, password: password })
        subtitleLogin = 'Usario creado exitosamente, Ahora inicia sesion'
        res.redirect('/login')
    }
})

app.get('/error' ,  (req, res) => {
    console.log(req.session)
    res.render('pages/error', {
        error: error,
        ruta: ruta
    })
})

app.get('*', (req, res) => {
    res.send(`Ruta: ${req.method} ${req.url} no esta implementada`)
    //logger.warn(`Ruta: ${req.method} ${req.url} no esta implementada`)
})


const mensajesMemoria = new ContenedorMemoria()        // Instancio contendor de mensajes en memoria

await mensajesDao.borrarTodo()                           // Borro los mensajes guardados en mongoDB
await productosDao.borrarTodo();                         // Booro los productos guardados en mongoDB


/* const prod = createManyProducts(5)                       // Mockeo 5 productos
prod.forEach(elem => {
    productosDao.guardar(elem)
}) */

//--------------------------Websockets----------------------------//

io.on('connection', async (socket) => {
    console.log('Nuevo cliente conectado!')

    /* Envio los productos y mensajes al cliente que se conectó */
    socket.emit('products', await productosDao.listarAll())
    socket.emit('messages',  mensajesMemoria.listarAll())

    /* Escucho el nuevo producto enviado por el cliente y se los propago a todos */
    socket.on('newProduct', async (newProduct) => {
        await productosDao.guardar(newProduct)
        console.log(newProduct)
        //logger.error('Error ficticio')
        io.sockets.emit('products', await productosDao.listarAll())
    })

    /* Escucho el nuevo mensaje de chat enviado por el cliente y se los propago a todos */
    socket.on('newMessage', async (res) =>{
        mensajesMemoria.guardar(res)
        await mensajesDao.guardar(res)
        io.sockets.emit('messages', mensajesMemoria.listarAll())
    })
})


//------------------YARGS---------------------------------//
import yargs from  'yargs'

const { /* port, */ mode } = yargs(process.argv.slice(2))
    .alias({
        //p: 'port',
        m: 'mode'
    })
    .default({
        //port: 8086,
        mode: 'fork'
    })
    .argv

//------------------------------------------------------------------//


import dotenv from 'dotenv'
dotenv.config()
let port = process.env.PORT || 8080

if(mode === 'cluster'){
    if (cluster.isPrimary) {
        console.log(`Primary ${process.pid} is running`);

        // Fork workers.
        for (let i = 0; i < numCPUs; i++) {
            cluster.fork();
        }

        cluster.on('exit', (worker, code, signal) => {
            console.log(`worker ${worker.process.pid} died`);
        });
    } else {

    //------------------Configuracion Server---------------------------------//
    
    

    const server = httpServer.listen(port, ()=>{
        console.log(`Servidor escuchando en el puerto ${server.address().port}`, `numero de cpus ${numCPUs}`)
    })
    server.on(`error`, error => console.log(`Error en servidor: ${error}`))

    }

}else{

    //------------------Configuracion Server---------------------------------//
 
    //const PORT = 8080
    const server = httpServer.listen(process.env.PORT, ()=>{
        puerto = server.address().port
        console.log(`Servidor escuchando en el puerto ${server.address().port}`, `numero de cpus ${numCPUs}`)
    })
    server.on(`error`, error => console.log(`Error en servidor: ${error}`))

}

let puerto;




