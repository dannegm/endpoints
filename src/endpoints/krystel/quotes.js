import { randomIndex, randomIndexWithMemory } from '@/helpers/arrays';
import { createSimpleMemoryHandler } from '@/helpers/handlers';

const icons = [
    'Candy',
    'Cake',
    'Gift',
    'PartyPopper',
    'Snowflake',
    'Clover',
    'Cat',
    'Flower',
    'Gem',
    'Lollipop',
    'MoonStar',
    'Origami',
    'Sparkles',
];

const borderPatterns = [
    'https://cdn.pixabay.com/photo/2023/03/20/19/42/zigzag-7865714_1280.png',
    'https://cdn.pixabay.com/photo/2020/03/12/13/05/blue-4925033_1280.png',
    'https://cdn.pixabay.com/photo/2017/02/15/20/33/floral-2069810_1280.png',
    'https://cdn.pixabay.com/photo/2021/11/22/10/14/floral-6816295_1280.png',
    'https://cdn.pixabay.com/photo/2023/08/07/13/40/flowers-8175044_1280.png',
    'https://cdn.pixabay.com/photo/2016/03/31/21/28/background-1296439_1280.png',
    'https://cdn.pixabay.com/photo/2021/02/01/12/44/flowers-5970534_1280.png',
    'https://cdn.pixabay.com/photo/2021/11/13/00/37/background-6790308_1280.png',
    'https://cdn.pixabay.com/photo/2023/05/10/13/27/orange-flowers-7984018_1280.png',
    'https://cdn.pixabay.com/photo/2021/11/19/15/21/christmas-6809681_1280.png',
    'https://cdn.pixabay.com/photo/2016/03/31/22/25/background-1297023_1280.png',
    'https://cdn.pixabay.com/photo/2022/03/21/13/44/background-7083246_1280.png',
    'https://cdn.pixabay.com/photo/2021/02/01/12/57/flowers-5970558_1280.png',
    'https://cdn.pixabay.com/photo/2022/06/03/10/13/flowers-7239823_1280.png',
    'https://cdn.pixabay.com/photo/2021/11/13/00/40/floral-background-6790313_1280.png',
    'https://cdn.pixabay.com/photo/2016/08/18/14/15/floral-pattern-1603073_1280.png',
    'https://cdn.pixabay.com/photo/2021/11/19/07/24/flowers-6808246_1280.png',
    'https://cdn.pixabay.com/photo/2022/02/27/10/11/background-7036995_1280.png',
    'https://cdn.pixabay.com/photo/2016/03/31/21/28/background-1296442_1280.png',
    'https://cdn.pixabay.com/photo/2022/05/23/16/13/stars-7216595_1280.png',
    'https://cdn.pixabay.com/photo/2018/03/13/19/55/floral-3223570_1280.png',
    'https://cdn.pixabay.com/photo/2015/05/08/10/13/seamless-pattern-757848_1280.png',
    'https://cdn.pixabay.com/photo/2021/11/27/23/33/donut-pattern-6829117_1280.png',
    'https://cdn.pixabay.com/photo/2020/11/09/01/39/floral-5725345_1280.png',
    'https://cdn.pixabay.com/photo/2016/03/31/21/53/abstract-1296714_1280.png',
    'https://cdn.pixabay.com/photo/2023/01/30/00/29/pattern-7754411_1280.png',
    'https://cdn.pixabay.com/photo/2022/12/31/00/37/pattern-7687826_1280.png',
    'https://cdn.pixabay.com/photo/2022/05/19/05/41/flowers-7206634_1280.png',
    'https://cdn.pixabay.com/photo/2022/08/01/00/48/background-7357096_1280.png',
    'https://cdn.pixabay.com/photo/2023/03/27/19/40/flowers-7881545_1280.png',
    'https://cdn.pixabay.com/photo/2015/05/06/13/40/purple-755266_1280.png',
    'https://cdn.pixabay.com/photo/2015/04/18/09/45/pattern-728509_1280.png',
    'https://cdn.pixabay.com/photo/2016/03/31/21/53/abstract-1296715_1280.png',
];

const bgPatterns = [
    'https://cdn.pixabay.com/photo/2021/09/16/08/56/leaves-6629581_1280.png',
    'https://cdn.pixabay.com/photo/2023/08/12/02/50/leaves-8184621_1280.png',
    'https://cdn.pixabay.com/photo/2018/12/25/11/10/deer-3894103_1280.png',
    'https://cdn.pixabay.com/photo/2019/05/05/21/42/doodle-4181783_1280.png',
    'https://cdn.pixabay.com/photo/2020/11/09/01/46/leaves-5725356_1280.png',
    'https://cdn.pixabay.com/photo/2016/06/24/15/48/pattern-1477380_1280.png',
    'https://cdn.pixabay.com/photo/2021/02/01/12/51/leaves-5970552_1280.png',
    'https://cdn.pixabay.com/photo/2023/03/11/01/22/pattern-7843452_1280.png',
    'https://cdn.pixabay.com/photo/2022/01/08/14/18/flowers-6924088_1280.png',
    'https://cdn.pixabay.com/photo/2016/04/12/20/12/ornamental-1325298_1280.png',
    'https://cdn.pixabay.com/photo/2022/11/07/02/40/pattern-7575465_1280.png',
    'https://cdn.pixabay.com/photo/2021/10/29/15/13/leaves-6752149_1280.png',
    'https://cdn.pixabay.com/photo/2022/03/21/13/44/background-7083247_1280.png',
    'https://cdn.pixabay.com/photo/2023/11/17/16/41/butterflies-8394629_1280.png',
    'https://cdn.pixabay.com/photo/2014/04/02/10/22/hibiscus-303637_1280.png',
    'https://cdn.pixabay.com/photo/2020/11/16/01/47/pandas-5747695_1280.png',
    'https://cdn.pixabay.com/photo/2020/05/21/21/07/flowers-5202790_1280.png',
    'https://cdn.pixabay.com/photo/2021/11/05/11/06/pattern-6771027_1280.png',
    'https://cdn.pixabay.com/photo/2023/02/06/00/37/triangle-pattern-7770878_1280.png',
    'https://cdn.pixabay.com/photo/2021/10/10/09/39/background-6696169_1280.png',
    'https://cdn.pixabay.com/photo/2021/10/10/09/38/background-6696153_1280.png',
    'https://cdn.pixabay.com/photo/2020/11/03/07/10/flowers-5708889_1280.png',
    'https://cdn.pixabay.com/photo/2020/06/24/16/14/pattern-5336743_1280.png',
    'https://cdn.pixabay.com/photo/2019/09/06/22/32/pattern-4457535_1280.png',
    'https://cdn.pixabay.com/photo/2020/11/09/01/42/leaves-5725346_1280.png',
    'https://cdn.pixabay.com/photo/2022/03/21/13/45/background-7083249_1280.png',
    'https://cdn.pixabay.com/photo/2022/12/26/21/05/geometric-pattern-7679782_1280.png',
    'https://cdn.pixabay.com/photo/2020/11/03/07/07/stripes-5708884_1280.png',
    'https://cdn.pixabay.com/photo/2016/03/31/21/53/abstract-1296713_1280.png',
];

const colorSchemes = [
    'bg-pink-100 text-pink-800',
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-purple-100 text-purple-800',
    'bg-red-100 text-red-800',
    'bg-yellow-100 text-yellow-800',
    'bg-teal-100 text-teal-800',
    'bg-indigo-100 text-indigo-800',
    'bg-cyan-100 text-cyan-800',
    'bg-rose-100 text-rose-800',
    'bg-amber-100 text-amber-800',
    'bg-lime-100 text-lime-800',
    'bg-emerald-100 text-emerald-800',
    'bg-sky-100 text-sky-800',
    'bg-fuchsia-100 text-fuchsia-800',
    'bg-violet-100 text-violet-800',
    'bg-orange-100 text-orange-800',
    'bg-neutral-100 text-neutral-800',
    'bg-zinc-100 text-zinc-800',
    'bg-gray-100 text-gray-800',
    'bg-slate-100 text-slate-800',
];

// Emojis recurrentes
// 😔 🤭 🫢 🥹 🥺

const quotes = [
    'Perdón por ser tan cursi a veces (//casi siempre//).',
    'Esta es la única forma que encontré de decirte (//casi//) todo lo que pienso.',
    'Sólo disfruta de todo lo que te doy sin deberme nada.',
    'Recordé que alguna vez mencionaste que los tulipanes blancos eran tus favoritos.',
    'Aún no descarto la posibilidad de algún día ir a Japón contigo 😔.',
    'Quisiera estar ahí para poder felicitarte con un abrazo.',
    'Escucho //Die With a Smile// y en automático pienso en ti.',
    'Me gustaría que el poder vernos se repita más seguido :).',
    'Vendré a dejarte más pensamientos por aquí de vez en cuando.',
    'Quizá yo sea el único $$celebrándote$$ a ti y no el año nuevo.',
    'Me encantaría que cada vez que sonríes, el mundo entero se detuviera para admirarte.',
    'A veces, el mundo necesita un recordatorio de lo %%increíble%% que eres.',
    'A veces siento que no te digo lo suficiente lo importante que eres para mí.',
    'Lo único que quiero para ti es que disfrutes de la vida, que encuentres razones para sonreír todos los días.',
    'Me gusta pensar que te hago sentir mejor, aunque sea solo por un momento. Ojalá fuera siempre.',
    'Me gustaría que pudieras ver lo $$increíble$$ que eres, porque a veces no te das cuenta de lo mucho que vales.',
    'Sabía que te mataba la curiosidad por saber qué era este sitio.',
    'Espero esta sorpresa te haya sacado más de alguna sonrisa.',
    'Cada que entres aquí, encontrarás algo nuevo :)',
    'No preguntes, sólo gózalo 7u7.',
    'Lo divertido de esto es que no tienes que leerlo todo de una vez, podrías leer sólo una frase cada día.',
    'Esta pequeña app es otra forma de estar cerca tuyo.',
    'Si picas muchas veces el botón de %%like%%, será como si me invocaras.',
    'Feliz año, por cierto 🎉.',
    'Mi plan era regalarte el brazalete para tu cumpleaños, pero me alegra habértelo dado antes y en persona.',
    'Cuenta hasta 10 y pide un $$deseo$$ :D.',
    'Obvio pensé en felicitarte desde el primer minuto hoy, pero quería sorprenderte de esta forma.',
    'Me hubiera gustado pasarla contigo el día de hoy.',
    'Espero que este pequeño detalle te haya hecho sonreír.',
    'Recuerda siempre lo especial e importante que eres para mí.',
    'Espero que estos mensajes te alegren el día.',
    'Sabes que aún hay un millón de cosas más que quisiera decirte.',
    'Yo sé que has intentado spamear los %%corazones%% 🫢.',
    'Lo mejor de mi 2024 fuiste tú y todas las veces que pude verte 😔.',
    'No hay un solo instante que no estés en mi cabeza.',
    'Ya estás más cerca de los 30 🫢.',
    '%%Like%% si te gustó la sorpresa 🤭.',
    'Extraño demasiado pasar tiempo contigo.',
    'Te quiero demasiado, nunca lo olvides.',
    'No hay nada que me llene más de alegría que verte feliz a causa mía.',
    // 2 de enero 2025
    '%%Amo%% tanto que esta app te haya gustado demasiado.',
    'Verte en persona también fue de mis cosas favoritas del 2024.',
    'No puedo esperar a verte de nuevo 😔.',
    'Me la paso muy bien cuando pasamos tiempo juntos.',
    '¿Te gusta la nueva opción de descargar las tarjetitas?',
    'Mientras sigas viniendo aquí a leerme, seguiré escribiendo para ti.',
    '[[[sun]]] Buenos días, por cierto :).',
    'Ojalá pudiera ver la %%sonrisa%% que pones cuando lees esto 🫢.',
    'Quizá ya lo sabes, ~:pero me encanta cuando me mandas fotos tuyas:~ 🫢.',
    'Me hizo muy %%feliz%% ver tu reacción a esta sorpresa, no esperaba que te gustara tanto.',
    'Soy muy $$afortunado$$ de tenerte en mi vida.',
    'Casi me derrito cuando me dijiste que he sido de las pocas personas que de verdad te han hecho $$feliz$$.',
    'No existe nada más bello que el saber de tu felicidad.',
    'Nunca dejes de spamear los %%corazones%% 🥹, //me gusta recibir esa notificación tuya//.',
    '[[[movie_time]]] ¿Te gustaría que te recomendara películas?',
];

//

const repetitionProbability = 0;

export const getRandomSettings = (memoryHandler = createSimpleMemoryHandler()) => {
    return [
        /* quote */ randomIndexWithMemory(quotes, memoryHandler, repetitionProbability),
        /* icon */ randomIndex(icons),
        /* border */ randomIndex(borderPatterns),
        /* bg */ randomIndex(bgPatterns),
        /* scheme */ randomIndex(colorSchemes),
    ].join(':');
};

export const quoteFromSettings = settings => {
    const decodedSettings = settings.split(':');
    return {
        settings,
        quote: quotes[decodedSettings[0]],
        icon: icons[decodedSettings[1]],
        border: `url(${borderPatterns[decodedSettings[2]]})`,
        bg: `url(${bgPatterns[decodedSettings[3]]})`,
        scheme: colorSchemes[decodedSettings[4]],
    };
};

export const getRandomQuote = memoryHandler => {
    const code = getRandomSettings(memoryHandler);
    return quoteFromSettings(code);
};
