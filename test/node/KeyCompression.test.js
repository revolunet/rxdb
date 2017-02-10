/**
 * this test is to the import/export behaviour
 */
import assert from 'assert';
import {
    default as randomToken
} from 'random-token';
import {
    default as clone
} from 'clone';
import * as _ from 'lodash';

import * as schemas from './../helper/schemas';
import * as schemaObjects from './../helper/schema-objects';
import * as humansCollection from './../helper/humans-collection';

import * as RxDatabase from '../../dist/lib/RxDatabase';
import * as RxSchema from '../../dist/lib/RxSchema';
import * as util from '../../dist/lib/util';

import * as KeyCompressor from '../../dist/lib/KeyCompressor';


describe('KeyCompressor.test.js', () => {

    describe('create table', () => {
        it('get a valid table', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.human));
            const table = k.table;
            assert.equal(
                Object.keys(table).length,
                3
            );
            Object.keys(table).forEach(k => {
                assert.equal(table[k].length, 2);
                assert.ok(table[k].startsWith('|'));
                assert.equal(typeof table[k], 'string');
            });
        });
        it('table assigns _id to primary', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.primaryHuman));
            const table = k.table;
            assert.equal(table.passportId, '_id');
        });
        it('table of nested', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.nestedHuman));
            const table = k.table;
            assert.equal(table['mainSkill.name'].length, 2);
            assert.equal(table['mainSkill.level'].length, 2);
        });
        it('table of deep nested', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.deepNestedHuman));
            const table = k.table;
            assert.equal(table['mainSkill.name'].length, 2);
            assert.equal(table['mainSkill.attack'].length, 2);
            assert.equal(table['mainSkill.attack.good'].length, 2);
            assert.equal(table['mainSkill.attack.count'].length, 2);
        });
        it('table of schema with array', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.heroArray));
            const table = k.table;
            assert.equal(table['skills.item'].length, 2);
            assert.equal(table['skills.item.name'].length, 2);
            assert.equal(table['skills.item.damage'].length, 2);
        });
        it('do not compress keys with <=3 chars', () => {
            const k = KeyCompressor.create(RxSchema.create({
                type: 'object',
                properties: {
                    z: {
                        type: 'string',
                        index: true
                    },
                    zz: {
                        type: 'string'
                    },
                    nest: {
                        type: 'object',
                        properties: {
                            z: {
                                type: 'string'
                            },
                            zz: {
                                type: 'string'
                            }
                        }
                    }
                }
            }));
            const table = k.table;
            assert.equal(Object.keys(table).length, 1);
            assert.ok(table.nest);
        });
    });

    describe('reverseTable', () => {
        it('reverse normal', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.human));
            const reverse = k.reverseTable;
            const table = k.table;

            Object.keys(table).forEach(key => {
                const val = table[key];
                assert.equal(reverse[val], key);
            });
        });
        it('reverse nested', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.nestedHuman));
            const reverse = k.reverseTable;
            const table = k.table;

            Object.keys(table).forEach(key => {
                const val = table[key];
                const field = key.split('.').pop();
                assert.ok(reverse[val].includes(field));
            });
        });
        it('reverse primary', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.primaryHuman));
            const reverse = k.reverseTable;
            const table = k.table;

            Object.keys(table).forEach(key => {
                const val = table[key];
                assert.equal(reverse[val], key);
            });
        });
    });

    describe('.compress()', () => {
        it('normal', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.human));
            const human = schemaObjects.human();
            const compressed = k.compress(human);

            const values = Object.keys(compressed)
                .map(key => compressed[key]);

            Object.keys(human).forEach(key => {
                const value = human[key];
                assert.ok(values.includes(value));
            });
        });
        it('primary', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.primaryHuman));
            const human = schemaObjects.human();
            const compressed = k.compress(human);

            const values = Object.keys(compressed)
                .map(key => compressed[key]);

            Object.keys(human).forEach(key => {
                const value = human[key];
                assert.ok(values.includes(value));
            });
        });
        it('should not compress _rev', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.primaryHuman));
            const human = schemaObjects.human();
            human._rev = 'foobar';
            const compressed = k.compress(human);
            assert.equal(human._rev, 'foobar');
        });
        it('nested', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.nestedHuman));
            const human = schemaObjects.nestedHuman();
            const compressed = k.compress(human);

            const values = Object.keys(compressed)
                .map(key => compressed[key]);

            // check top
            Object.keys(human).forEach(key => {
                const value = human[key];
                if (typeof value !== 'object')
                    assert.ok(values.includes(value));
            });

            // check nested
            const nestedObj = Object.keys(compressed)
                .map(key => compressed[key])
                .filter(value => typeof value === 'object')
                .pop();
            const nestedValues = Object.keys(nestedObj)
                .map(key => nestedObj[key]);
            Object.keys(human.mainSkill).forEach(key => {
                const value = human.mainSkill[key];
                if (typeof value !== 'object')
                    assert.ok(nestedValues.includes(value));
            });
        });
        it('deep nested', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.deepNestedHuman));
            const human = schemaObjects.deepNestedHuman();
            const compressed = k.compress(human);

            const json = JSON.stringify(compressed);
            Object.keys(human).forEach(key => {
                const value = human[key];
                if (typeof value !== 'object')
                    assert.ok(json.includes(value));
            });
        });
        it('additional value', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.deepNestedHuman));
            const human = schemaObjects.deepNestedHuman();
            const additionalValue = {
                foo: 'bar'
            };
            human.foobar = additionalValue;
            const compressed = k.compress(human);

            const json = JSON.stringify(compressed);
            Object.keys(human).forEach(key => {
                const value = human[key];
                if (typeof value !== 'object')
                    assert.ok(json.includes(value));
            });

            assert.deepEqual(compressed.foobar, additionalValue);
        });

        it('schema with array', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.heroArray));
            const human = schemaObjects.heroArray();
            const compressed = k.compress(human);
            const json = JSON.stringify(compressed);
            Object.keys(human).forEach(key => {
                const value = human[key];
                if (typeof value !== 'object')
                    assert.ok(json.includes(value));
            });

            // array elements
            human.skills.forEach(skill => {
                assert.ok(json.includes(skill.name));
                assert.ok(json.includes(skill.damage));
            });
        });
    });

    describe('.decompress()', () => {
        it('normal', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.human));
            const human = schemaObjects.human();
            const compressed = k.compress(human);
            const decompressed = k.decompress(compressed);
            assert.deepEqual(human, decompressed);
        });
        it('nested', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.nestedHuman));
            const human = schemaObjects.nestedHuman();
            const compressed = k.compress(human);

            const decompressed = k.decompress(compressed);
            assert.deepEqual(human, decompressed);
        });
        it('deep nested', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.deepNestedHuman));
            const human = schemaObjects.deepNestedHuman();
            const compressed = k.compress(human);

            const decompressed = k.decompress(compressed);
            assert.deepEqual(human, decompressed);
        });
        it('additional value', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.deepNestedHuman));
            const human = schemaObjects.deepNestedHuman();
            const additionalValue = {
                foo: 'bar'
            };
            human.foobar = additionalValue;
            const compressed = k.compress(human);
            const decompressed = k.decompress(compressed);
            assert.deepEqual(human, decompressed);
        });
        it('primary', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.primaryHuman));
            const human = schemaObjects.heroArray();
            const compressed = k.compress(human);
            const decompressed = k.decompress(compressed);

            assert.deepEqual(human, decompressed);
        });
        it('schema with array', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.heroArray));
            const human = schemaObjects.heroArray();
            const compressed = k.compress(human);
            const decompressed = k.decompress(compressed);
            assert.deepEqual(human, decompressed);
        });
        it('BUG: _rev gets undefined', () => {
            const k = KeyCompressor.create(RxSchema.create(schemas.heroArray));
            const human = schemaObjects.heroArray();
            const compressed = k.compress(human);
            compressed._rev = 'foobar';
            const decompressed = k.decompress(compressed);
            assert.equal(decompressed._rev, 'foobar');
        });
    });

    describe('RxQuery().keyCompress()', () => {
        it('transform basic search keys', async() => {
            const c = await humansCollection.create(0);
            const query = c.find()
                .where('firstName').eq('myFirstName')
                .keyCompress();
            const jsonString = JSON.stringify(query);
            assert.ok(!jsonString.includes('firstName'));
            assert.ok(jsonString.includes('myFirstName'));
            assert.equal(query.selector[c.keyCompressor.table['firstName']], 'myFirstName');
        });
        it('primary', async() => {
            const c = await humansCollection.createPrimary(0);
            const query = c.find()
                .where('passportId').eq('myPassportId')
                .keyCompress();
            const jsonString = JSON.stringify(query);
            assert.ok(!jsonString.includes('passportId'));
            assert.ok(jsonString.includes('myPassportId'));
            assert.equal(query.selector._id, 'myPassportId');
        });
        it('nested', async() => {
            const c = await humansCollection.createNested(0);
            const query = c.find()
                .where('mainSkill.level').eq(5)
                .keyCompress();

            const cString = [
                c.keyCompressor.table['mainSkill'],
                c.keyCompressor.table['mainSkill.level']
            ].join('.');
            const jsonString = JSON.stringify(query);
            assert.ok(!jsonString.includes('level'));
            assert.ok(jsonString.includes(5));

            assert.equal(query.selector[cString], 5);
        });

        it('additional attribute', async() => {
            const c = await humansCollection.create(0);
            const query = c.find()
                .where('foobar').eq(5)
                .keyCompress();

            assert.equal(query.selector.foobar, 5);
        });
        it('additional nested attribute', async() => {
            const c = await humansCollection.createNested(0);
            const query = c.find()
                .where('mainSkill.foobar').eq(5)
                .keyCompress();

            const cString = [
                c.keyCompressor.table['mainSkill'],
                'foobar'
            ].join('.');
            assert.equal(query.selector[cString], 5);
        });
        it('additional deep nested attribute', async() => {
            const c = await humansCollection.createDeepNested(0);
            const query = c.find()
                .where('mainSkill.attack.foobar').eq(5)
                .keyCompress();

            const cString = [
                c.keyCompressor.table['mainSkill'],
                c.keyCompressor.table['mainSkill.attack'],
                'foobar'
            ].join('.');
            assert.equal(query.selector[cString], 5);
        });
        it('.sort()', async() => {
            const c = await humansCollection.createDeepNested(0);
            const query = c.find()
                .sort('mainSkill')
                .keyCompress();
            assert.equal(query.sort[0][c.keyCompressor.table['mainSkill']], 'asc');
        });
        it('.sort() nested', async() => {
            const c = await humansCollection.createNested(0);
            const query = c.find()
                .sort('mainSkill.level')
                .keyCompress();

            const cString = [
                c.keyCompressor.table['mainSkill'],
                c.keyCompressor.table['mainSkill.level']
            ].join('.');
            assert.equal(query.sort[0][cString], 'asc');
        });
    });


    describe('integration into pouchDB', () => {
        it('should have saved a compressed document', async() => {
            const c = await humansCollection.createPrimary(0);
            const docData = schemaObjects.simpleHuman();
            await c.insert(docData);
            const doc = await c.pouch.get(docData.passportId);

            Object.keys(doc).forEach(key => {
                assert.ok(key.length <= 4);
                assert.equal(typeof doc[key], 'string');
            });
            assert.equal(doc._id, docData.passportId);
            assert.equal(doc['|a'], docData.firstName);
        });

    });

    describe('disable key-compression', () => {
        describe('.doKeyCompression()', () => {
            it('doKeyCompression(): true', async() => {
                const schemaJSON = clone(schemas.human);
                schemaJSON.disableKeyCompression = true;
                const schema = RxSchema.create(schemaJSON);
                assert.equal(schema.doKeyCompression(), false);
            });
            it('doKeyCompression(): false', async() => {
                const schemaJSON = clone(schemas.human);
                schemaJSON.disableKeyCompression = false;
                const schema = RxSchema.create(schemaJSON);
                assert.equal(schema.doKeyCompression(), true);
            });
        });
        describe('.compress()', async() => {
            it('do not compress', async() => {
                const col = await humansCollection.createNoCompression(0);
                const human = schemaObjects.human();
                const after = col.keyCompressor.compress(human);
                assert.deepEqual(human, after);
                assert.ok(typeof after.lastName, 'string');
            });
        });
        describe('.decompress()', async() => {
            it('do not compress', async() => {
                const col = await humansCollection.createNoCompression(0);
                const human = schemaObjects.human();
                const after = col.keyCompressor.decompress(human);
                assert.deepEqual(human, after);
                assert.ok(typeof after.lastName, 'string');
            });
        });

    });

    describe('bugs', () => {

        it('BUG: #50 compress string array properly', async() => {
            const mySchema = {
                title: 'hero schema',
                description: 'describes a simple hero',
                type: 'object',
                properties: {
                    likes: {
                        type: 'array',
                        items: {
                            type: 'string'
                        }
                    }
                }
            };

            const db = await RxDatabase.create('heroesDB', 'memory');
            const collection = await db.collection('mycollection', mySchema);
            const docData = {
                likes: ['abc', '8']
            };
            await collection.insert(docData);
            const doc = await collection.findOne().exec();
            assert.equal(doc.constructor.name, 'RxDocument');
            assert.deepEqual(doc.likes, docData.likes);
        });
    });
});
