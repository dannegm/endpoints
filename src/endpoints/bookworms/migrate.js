import { lowerCase, deburr } from 'lodash';

import ntfy from '@/services/ntfy';
import { buildCustomLogger } from '@/services/logger';
import { supabase } from '@/services/supabase';
import { pipe } from '@/helpers/utils';

const logger = buildCustomLogger('migrate');
const $schema = supabase.schema('bookworms');

const toString = str => str.toString();
const normalize = pipe([toString, lowerCase, deburr]);

export const upsertAuthor = async ({ name }) => {
    const { data: existingAuthorData } = await $schema
        .from('authors')
        .select()
        .eq('name', name)
        .single();

    if (existingAuthorData) {
        return existingAuthorData;
    }

    const { data: newAuthorData, error } = await $schema
        .from('authors')
        .insert({ name, name_normalized: normalize(name) })
        .select();

    if (error) {
        logger.error(`Error on author creation: ${error.message}`);
        console.log(error);
        return null;
    }

    logger.info(`Author created: ${name}`);

    return newAuthorData[0];
};

export const upsertSerie = async ({ name }) => {
    const { data: existingAuthorData } = await $schema
        .from('series')
        .select()
        .eq('name', name)
        .single();

    if (existingAuthorData) {
        return existingAuthorData;
    }

    const { data: newAuthorData, error } = await $schema
        .from('series')
        .insert({ name, name_normalized: normalize(name) })
        .select();

    if (error) {
        logger.error(`Error on author creation: ${error.message}`);
        console.log(error);
        return null;
    }

    logger.info(`Serie created: ${name}`);

    return newAuthorData[0];
};

export const attachBookAuthor = async ({ bookId, authorId }) => {
    const { data, error } = await $schema
        .from('authors_books')
        .insert({ book_id: bookId, author_id: authorId })
        .select();

    if (error) {
        logger.error(`Error on author attachment: ${error.message}`);
        console.log(error);
        return null;
    }

    logger.info(`Attaching author: b/${bookId} a/${authorId}`);
    return data[0];
};

export const attachBookSerie = async ({ bookId, serieId }) => {
    const { data, error } = await $schema
        .from('series_books')
        .insert({ book_id: bookId, serie_id: serieId })
        .select();

    if (error) {
        logger.error(`Error on serie attachment: ${error.message}`);
        console.log(error);
        return null;
    }

    logger.info(`Attaching serie: b/${bookId} a/${serieId}`);
    return data[0];
};

export const upsertBook = async book => {
    const { data: existingBookData } = await $schema
        .from('books')
        .select('id')
        .eq('libid', book.libid)
        .single();

    if (existingBookData) {
        logger.info(`Skiping book: ${book.title}`);
        return existingBookData;
    }

    const { data: newBookData, error } = await $schema
        .from('books')
        .insert({
            libid: book.libid,
            title: book.title,
            title_normalized: normalize(book.title),
            description: book.description,
            labels: book.labels,
            published: book.published,
            pagecount: book.pagecount,
            sha256sum: book.sha256sum,
            size: book.size,
            filename: book.filename,
            serie_name: book.serie,
            serie_name_normalized: book.serie ? normalize(book.serie) : undefined,
            serie_sequence: book.serieseq,
        })
        .select();

    if (error) {
        logger.error(`Error on book creation: ${error.message}`);
        console.log(error);
        return null;
    }

    logger.info(`Book created: ${book.title}`);
    const bookData = newBookData[0];

    for (const author of book.authors) {
        const authorData = await upsertAuthor({ name: author });
        await attachBookAuthor({ bookId: bookData.id, authorId: authorData.id });
    }

    if (book.serie) {
        const serieData = await upsertSerie({ name: book.serie });
        await attachBookSerie({ bookId: bookData.id, serieId: serieData.id });
    }

    return bookData;
};

export const loadBooks = async filePath => {
    const { default: data } = await import(filePath);

    for (const book of data) {
        console.log('+'.repeat(32));
        await upsertBook(book);
    }

    console.log('#'.repeat(32));
    logger.success(`All miration complete!. ${data} books imported`);

    ntfy.pushRich({
        title: 'Importing Books DB',
        message: 'Imports complete',
    });
};
