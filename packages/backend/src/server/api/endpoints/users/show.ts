import { resolveUser } from '@/remote/resolve-user.js';
import define from '../../define.js';
import { apiLogger } from '../../logger.js';
import { ApiError } from '../../error.js';
import { Users, Followings } from '@/models/index.js';
import { In } from 'typeorm';
import { User } from '@/models/entities/user.js';

export const meta = {
	tags: ['users'],

	requireCredential: false,

	res: {
		optional: false, nullable: false,
		oneOf: [
			{
				type: 'object',
				ref: 'UserDetailed',
			},
			{
				type: 'array',
				items: {
					type: 'object',
					ref: 'UserDetailed',
				}
			},
		]
	},

	errors: {
		failedToResolveRemoteUser: {
			message: 'Failed to resolve remote user.',
			code: 'FAILED_TO_RESOLVE_REMOTE_USER',
			id: 'ef7b9be4-9cba-4e6f-ab41-90ed171c7d3c',
			kind: 'server',
		},

		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '4362f8dc-731f-4ad8-a694-be5a88922a24',
		},

		forbidden: {
			message: 'Forbidden.',
			code: 'FORBIDDEN',
			id: '3c6a84db-d619-26af-ca14-06232a21df8a',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		userIds: { type: 'array', uniqueItems: true, items: {
			type: 'string', format: 'misskey:id',
		} },
		username: { type: 'string' },
		host: { type: 'string', nullable: true },
	},
	required: [],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, me) => {
	let user;

	const isAdminOrModerator = me && (me.isAdmin || me.isModerator);

	if (ps.userIds) {
		if (ps.userIds.length === 0) {
			return [];
		}

		const users = await Users.find(isAdminOrModerator ? {
			id: In(ps.userIds),
			isDeleted: false,
		} : {
			id: In(ps.userIds),
			isSuspended: false,
			isDeleted: false,
		});

		// リクエストされた通りに並べ替え
		const _users: User[] = [];
		for (const id of ps.userIds) {
			const user = users.find((u) => u.id === id);
			if (user) _users.push(user);
		}

		return await Users.packMany(_users, me, {
			detail: true,
		});
	} else {
		// Lookup user
		if (typeof ps.host === 'string' && typeof ps.username === 'string') {
			user = await resolveUser(ps.username, ps.host).catch(e => {
				apiLogger.warn(`failed to resolve remote user: ${e}`);
				throw new ApiError(meta.errors.failedToResolveRemoteUser);
			});
		} else {
			const q: any = ps.userId != null
				? { id: ps.userId }
				: { usernameLower: ps.username!.toLowerCase(), host: null };

			user = await Users.findOne(q);
		}

		if (user == null || (!isAdminOrModerator && user.isSuspended) || user.isDeleted) {
			throw new ApiError(meta.errors.noSuchUser);
		}

		if (!isAdminOrModerator && user.isHidden) {
			if (me == null) {
				throw new ApiError(meta.errors.forbidden);
			} else if (me.id !== user.id) {
				const following = await Followings.findOne({
					followeeId: user.id,
					followerId: me.id,
				});
				if (following == null) {
					throw new ApiError(meta.errors.forbidden);
				}
			}
		}

		return await Users.pack(user, me, {
			detail: true,
		});
	}
});
