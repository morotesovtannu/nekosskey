import Router from '@koa/router';
import config from '@/config/index.js';
import $ from 'cafy';
import { ID } from '@/misc/cafy-id.js';
import * as url from '@/prelude/url.js';
import { renderActivity } from '@/remote/activitypub/renderer/index.js';
import renderOrderedCollection from '@/remote/activitypub/renderer/ordered-collection.js';
import renderOrderedCollectionPage from '@/remote/activitypub/renderer/ordered-collection-page.js';
import renderFollowUser from '@/remote/activitypub/renderer/follow-user.js';
import { setResponseType } from '../activitypub.js';
import { Users, Followings, UserProfiles } from '@/models/index.js';
import { LessThan } from 'typeorm';
import checkFetch from '@/remote/activitypub/check-fetch.js';
import { fetchMeta } from '@/misc/fetch-meta.js';

export default async (ctx: Router.RouterContext) => {
	const verify = await checkFetch(ctx.req);
	if (verify != 200) {
		ctx.status = verify;
		return;
	}

	const userId = ctx.params.user;

	// Get 'cursor' parameter
	const [cursor, cursorErr] = $.default.optional.type(ID).get(ctx.request.query.cursor);

	// Get 'page' parameter
	const pageErr = !$.default.optional.str.or(['true', 'false']).ok(ctx.request.query.page);
	const page: boolean = ctx.request.query.page === 'true';

	// Validate parameters
	if (cursorErr || pageErr) {
		ctx.status = 400;
		return;
	}

	// Verify user
	const user = await Users.findOne({
		id: userId,
		host: null,
	});

	if (user == null) {
		ctx.status = 404;
		return;
	}

	//#region Check ff visibility
	const profile = await UserProfiles.findOneOrFail(user.id);

	//if (profile.ffVisibility === 'private') {
	//	ctx.status = 403;
	//	ctx.set('Cache-Control', 'public, max-age=30');
	//	return;
	//} else if (profile.ffVisibility === 'followers') {
	//	ctx.status = 403;
	//	ctx.set('Cache-Control', 'public, max-age=30');
	//	return;
	//}
	const followersCount = profile == null ? 0 :
		(profile.ffVisibility === 'public') ? user.followersCount :
		0;

	//#endregion

	const limit = 10;
	const partOf = `${config.url}/users/${userId}/followers`;

	if (page) {
		if (profile.ffVisibility !== 'public') {
			ctx.status = 403;
			ctx.set('Cache-Control', 'public, max-age=30');
			return;
		}

		const query = {
			followeeId: user.id,
		} as any;

		// カーソルが指定されている場合
		if (cursor) {
			query.id = LessThan(cursor);
		}

		// Get followers
		const followings = await Followings.find({
			where: query,
			take: limit + 1,
			order: { id: -1 },
		});

		// 「次のページ」があるかどうか
		const inStock = followings.length === limit + 1;
		if (inStock) followings.pop();

		const renderedFollowers = await Promise.all(followings.map(following => renderFollowUser(following.followerId)));
		const rendered = renderOrderedCollectionPage(
			`${partOf}?${url.query({
				page: 'true',
				cursor,
			})}`,
			followersCount, renderedFollowers, partOf,
			undefined,
			inStock ? `${partOf}?${url.query({
				page: 'true',
				cursor: followings[followings.length - 1].id,
			})}` : undefined
		);

		ctx.body = renderActivity(rendered);
		setResponseType(ctx);
	} else {
		// index page
		const rendered = renderOrderedCollection(partOf, followersCount, (profile.ffVisibility === 'public') ? `${partOf}?page=true` : undefined);
		ctx.body = renderActivity(rendered);
		setResponseType(ctx);
	}

	const meta = await fetchMeta();
	if (meta.secureMode || meta.privateMode) {
		ctx.set('Cache-Control', 'private, max-age=0, must-revalidate');
	} else {
		ctx.set('Cache-Control', 'public, max-age=180');
	}
};
