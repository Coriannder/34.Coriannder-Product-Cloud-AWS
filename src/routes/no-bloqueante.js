import { fork } from 'child_process'
//import { calculo } from '../calculo/calculo.js';
import { Router } from 'express';
export const noBloqueante = Router();

noBloqueante.get('/', (req, res) => {
    const cantidad = Number(req.query.cant) || 100000000

    const forked = fork('./src/calculo/calculo.js')
    forked.send(cantidad);
    forked.on('message', datos => {
        res.json(datos)
        console.log(datos)

    
    })



    //const datos = calculo(cantidad)



    


    //return Math.random() * (max - min) + min;

})
