import define from '../../../define.js';
import { Emojis, DriveFiles } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import { getConnection } from 'typeorm';
import { insertModerationLog } from '@/services/insert-moderation-log.js';
import { ApiError } from '../../../error.js';
import rndstr from 'rndstr';
import { publishBroadcastStream } from '@/services/stream.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,

	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'MO_SUCH_FILE',
			id: 'fc46b5a4-6b92-4c33-ac66-b806659bb5cf',
		},
		duplicateName: {
			message: 'Duplicate name.',
			code: 'DUPLICATE_NAME',
			id: 'f7a3462c-4e6e-4069-8421-b9bd4f4c3975',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		fileId: { type: 'string', format: 'misskey:id' },
	},
	required: ['fileId'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, me) => {
	const file = await DriveFiles.findOne(ps.fileId);

	if (file == null) throw new ApiError(meta.errors.noSuchFile);

	const name = file.name.split('.')[0].match(/^[a-z0-9_]+$/) ? file.name.split('.')[0] : `_${rndstr('a-z0-9', 8)}_`;

	let existemojis = await Emojis.findOne({
		host: null,
		name: name,
	});

	if (existemojis != null) {
		throw new ApiError(meta.errors.duplicateName);
	}

	const emoji = await Emojis.insert({
		id: genId(),
		updatedAt: new Date(),
		name: name,
		category: null,
		host: null,
		aliases: [],
		originalUrl: file.url,
		publicUrl: file.webpublicUrl ?? file.url,
		type: file.webpublicType ?? file.type,
	}).then(x => Emojis.findOneOrFail(x.identifiers[0]));

	await getConnection().queryResultCache!.remove(['meta_emojis']);

	publishBroadcastStream('emojiAdded', {
		emoji: await Emojis.pack(emoji.id),
	});

	insertModerationLog(me, 'addEmoji', {
		emojiId: emoji.id,
	});

	return {
		id: emoji.id,
	};
});
