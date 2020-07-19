'use strict'

const { difference, uniq } = require('lodash')
const Model = require('./abstract-model')

module.exports = class AbstractTrackList extends Model {
  constructor(name, definition) {
    super(name, table => {
      definition(table)
      table.json('trackIds')
    })
    this.jsonColumns.push('trackIds')
  }

  async save(data) {
    if (!Array.isArray(data)) {
      data = [data]
    }
    const serialize = this.makeSerializer()

    return this.db.transaction(async trx => {
      const previous = (
        await trx(this.name)
          .select()
          .whereIn(
            'id',
            data.map(({ id }) => id)
          )
      ).map(this.makeDeserializer())

      const { saved, removed } = data.reduce(
        ({ saved, removed }, trackList) => {
          const previousList = previous.find(
            ({ id }) => id === trackList.id
          ) || {
            media: null,
            trackIds: []
          }
          const savedList = {
            ...previousList,
            trackIds: uniq(
              difference(
                previousList.trackIds.concat(trackList.trackIds || []),
                trackList.removedTrackIds
              )
            )
          }
          if (savedList.trackIds.length) {
            // one can not update with sparse data: we have to get previous columns
            for (const col of Object.keys(trackList)) {
              if (
                col !== 'trackIds' &&
                col !== 'removedTrackIds' &&
                trackList[col] !== undefined
              ) {
                savedList[col] = trackList[col]
              }
            }
            saved.push(serialize(savedList))
          } else {
            removed.push(trackList.id)
          }
          return { saved, removed }
        },
        { saved: [], removed: [] }
      )

      if (saved.length) {
        const cols = Object.keys(saved[0])
        await trx.raw(
          `? on conflict (\`id\`) do update set ${cols
            .map(col => `\`${col}\` = excluded.\`${col}\``)
            .join(', ')}`,
          [trx(this.name).insert(saved)]
        )
      }
      if (removed.length) {
        await trx(this.name).whereIn('id', removed).delete()
      }
    })
  }
}