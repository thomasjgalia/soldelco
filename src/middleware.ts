import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { getIdentity } from './lib/auth';

// The site is public. This just attaches the visitor's identity (if any)
// to locals so pages/endpoints can decide what requires one — RSVPs,
// comments, reactions, and the admin area all check for it themselves.
export const onRequest = defineMiddleware(async (context, next) => {
	const identity = await getIdentity(context.cookies, env.IDENTITY_SECRET);
	if (identity) context.locals.identity = identity;
	return next();
});
