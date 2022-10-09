import mongoose from 'mongoose'
import transformMongoObject from '../utils/objectUtils.js'
import { URL_MONGO } from '../config/config.js'



await  mongoose.connect(URL_MONGO, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Base de datos conectada'))
.catch(err => console.log("no se conecto"))


class ContenedorMongoDb {
    constructor (nombreCollection, squema) {
        this.collection = mongoose.model(nombreCollection, squema)
    }

    async listar(id) {
        try {
            const res = await this.collection.find({_id: id})
            return transformMongoObject(res)
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async listarAll() {
        try {
            const res = await this.collection.find({})
            if(res.length == 0){
                return res
            }else{
                return transformMongoObject(res)
            }
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async guardar(elemento) {
        try {
            const res = await this.collection.create(elemento)
            return transformMongoObject(res)
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async actualizar(id, elemento) {
        try {
            const res = await this.collection.updateOne({_id: id} , { $set: elemento })
            return res.acknowledged
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async borrar(id) {
        try {
            const res = await   this.collection.deleteOne({_id: id})
            return res.acknowledged
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async borrarTodo() {
        try {
            const res = await   this.collection.deleteMany()
            return res.acknowledged
        } catch (error) {
            console.log(error)
            return false
        }
    }
}

export default ContenedorMongoDb
