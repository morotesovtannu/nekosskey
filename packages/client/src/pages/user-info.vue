<template>
<MkSpacer :content-max="500" :margin-min="16" :margin-max="32">
	<FormSuspense :p="init">
		<div class="_formRoot">
			<div class="_formBlock aeakzknw">
				<MkAvatar class="avatar" :user="user" :show-indicator="true"/>
			</div>

			<FormLink :to="userPage(user)">Profile</FormLink>

			<div class="_formBlock">
				<MkKeyValue :copy="acct(user)" oneline style="margin: 1em 0;">
					<template #key>Acct</template>
					<template #value><span class="_monospace">{{ acct(user) }}</span></template>
				</MkKeyValue>

				<MkKeyValue :copy="user.id" oneline style="margin: 1em 0;">
					<template #key>ID</template>
					<template #value><span class="_monospace">{{ user.id }}</span></template>
				</MkKeyValue>

				<MkKeyValue :copy="info.email" v-if="info && $i.isAdmin" oneline style="margin: 1em 0;">
					<template #key>Email</template>
					<template #value><span class="_monospace">{{ info.email }}</span></template>
				</MkKeyValue>

				<MkKeyValue v-if="info" oneline style="margin: 1em 0;">
					<template #key>Email Status</template>
					<template v-if="$i.isAdmin && info.email && info.emailVerified" #value><span class="_monospace">Verified</span></template>
					<template v-if="$i.isAdmin && info.email && !info.emailVerified" #value><span class="_monospace">Not Verified</span></template>
					<template v-if="$i.isAdmin && !info.email" #value><span class="_monospace">Not Registered</span></template>
					<template v-if="!$i.isAdmin && info.emailVerified" #value><span class="_monospace">Verified</span></template>
					<template v-if="!$i.isAdmin && !info.emailVerified" #value><span class="_monospace">Not Verified / Not Registered</span></template>
				</MkKeyValue>

			</div>

			<FormSection v-if="iAmModerator">
				<template #label>Moderation</template>
				<FormSwitch v-if="user.host == null && $i.isAdmin && (moderator || !user.isAdmin)" v-model="moderator" class="_formBlock" @update:modelValue="toggleModerator">{{ $ts.moderator }}</FormSwitch>
				<FormSwitch v-model="silenced" class="_formBlock" @update:modelValue="toggleSilence">{{ $ts.silence }}</FormSwitch>
				<FormSwitch v-if="user.host == null && iAmModerator" v-model="localsilenced" class="_formBlock" @update:modelValue="toggleLocalSilence">{{ $ts.localsilence }}</FormSwitch>
				<FormSwitch v-if="user.host != null && iAmModerator" v-model="privatesilenced" class="_formBlock" @update:modelValue="toggleprivatesilence">{{ $ts.privatesilence }}</FormSwitch>
				<FormSwitch v-model="forcesensitive" class="_formBlock" @update:modelValue="toggleForceSensitive">{{ $ts.forcesensitive }}</FormSwitch>
				<FormSwitch v-if="user.host == null && iAmModerator" v-model="disabled" class="_formBlock" @update:modelValue="toggleDisable">{{ $ts.accountdisable }}</FormSwitch>
				<FormSwitch v-if="iAmModerator" v-model="hidden" class="_formBlock" @update:modelValue="toggleHide">{{ $ts.accounthide }}</FormSwitch>
				<FormSwitch v-model="suspended" class="_formBlock" @update:modelValue="toggleSuspend">{{ $ts.suspend }}</FormSwitch>
				<FormButton v-if="user.host == null && iAmModerator" class="_formBlock" @click="resetPassword"><i class="fas fa-key"></i> {{ $ts.resetPassword }}</FormButton>
				<FormButton v-if="iAmModerator" class="_formBlock" @click="deleteAllFiles"><i class="fas fa-trash-alt"></i> {{ $ts.deleteAllFiles }}</FormButton>
				<FormButton v-if="user.host == null && iAmModerator" class="_formBlock" @click="sendModNotification"><i class="fas fa-bell"></i> {{ $ts.sendModNotification }}</FormButton>
			</FormSection>

			<FormSection v-if="iAmModerator">
				<template #label>{{ $ts.usageAmount }}</template>
				<div class="_formBlock uawsfosz">
					<div class="meter"><div :style="meterStyle"></div></div>
				</div>
				<FormSplit>
					<MkKeyValue class="_formBlock">
						<template #key>{{ $ts.capacity }}</template>
						<template #value>{{ bytes(capacity, 1) }}</template>
					</MkKeyValue>
					<MkKeyValue class="_formBlock">
						<template #key>{{ $ts.inUse }}</template>
						<template #value>{{ bytes(usage, 1) }}</template>
					</MkKeyValue>
				</FormSplit>
			</FormSection>

			<FormSection>
				<template #label>ActivityPub</template>

				<div class="_formBlock">
					<MkKeyValue v-if="user.host" oneline style="margin: 1em 0;">
						<template #key>{{ $ts.instanceInfo }}</template>
						<template #value><MkA :to="`/instance-info/${user.host}`" class="_link">{{ user.host }} <i class="fas fa-angle-right"></i></MkA></template>
					</MkKeyValue>
					<MkKeyValue v-else oneline style="margin: 1em 0;">
						<template #key>{{ $ts.instanceInfo }}</template>
						<template #value>(Local user)</template>
					</MkKeyValue>
					<MkKeyValue oneline style="margin: 1em 0;">
						<template #key>{{ $ts.updatedAt }}</template>
						<template #value><MkTime v-if="user.lastFetchedAt" mode="detail" :time="user.lastFetchedAt"/><span v-else>N/A</span></template>
					</MkKeyValue>
					<MkKeyValue v-if="ap" oneline style="margin: 1em 0;">
						<template #key>Type</template>
						<template #value><span class="_monospace">{{ ap.type }}</span></template>
					</MkKeyValue>
				</div>

				<FormButton v-if="user.host != null" class="_formBlock" @click="updateRemoteUser"><i class="fas fa-sync"></i> {{ $ts.updateRemoteUser }}</FormButton>
			</FormSection>

			<MkObjectView tall :value="user">
			</MkObjectView>
		</div>
	</FormSuspense>
</MkSpacer>
</template>

<script lang="ts">
import { computed, defineAsyncComponent, defineComponent } from 'vue';
import MkObjectView from '@/components/object-view.vue';
import FormTextarea from '@/components/form/textarea.vue';
import FormSwitch from '@/components/form/switch.vue';
import FormLink from '@/components/form/link.vue';
import FormSection from '@/components/form/section.vue';
import FormButton from '@/components/ui/button.vue';
import MkKeyValue from '@/components/key-value.vue';
import FormSuspense from '@/components/form/suspense.vue';
import * as os from '@/os';
import number from '@/filters/number';
import bytes from '@/filters/bytes';
import * as symbols from '@/symbols';
import { url } from '@/config';
import { userPage, acct } from '@/filters/user';
import * as tinycolor from 'tinycolor2';

export default defineComponent({
	components: {
		FormSection,
		FormTextarea,
		FormSwitch,
		MkObjectView,
		FormButton,
		FormLink,
		MkKeyValue,
		FormSuspense,
	},

	props: {
		userId: {
			type: String,
			required: true
		}
	},

	data() {
		return {
			[symbols.PAGE_INFO]: computed(() => ({
				title: this.user ? acct(this.user) : this.$ts.userInfo,
				icon: 'fas fa-info-circle',
				bg: 'var(--bg)',
				actions: this.user ? [this.user.url ? {
					text: this.user.url,
					icon: 'fas fa-external-link-alt',
					handler: () => {
						window.open(this.user.url, '_blank');
					}
				} : undefined].filter(x => x !== undefined) : [],
			})),
			init: null,
			user: null,
			info: null,
			ap: null,
			moderator: false,
			silenced: false,
			localsilenced: false,
			privatesilenced: false,
			forcesensitive: false,
			disabled: false,
			hidden: false,
			suspended: false,
			usage: null,
			capacity: null,
		};
	},

	computed: {
		iAmModerator(): boolean {
			return this.$i && (this.$i.isAdmin || this.$i.isModerator);
		},
		meterStyle(): any {
			return {
				width: `${this.usage / this.capacity * 100}%`,
				background: tinycolor({
					h: 180 - (this.usage / this.capacity * 180),
					s: 0.7,
					l: 0.5
				})
			};
		},
	},

	watch: {
		userId: {
			handler() {
				this.init = this.createFetcher();
			},
			immediate: true
		},
		user() {
			os.api('ap/get', {
				uri: this.user.uri || `${url}/users/${this.user.id}`
			}).then(res => {
				this.ap = res;
			});
		}
	},

	methods: {
		number,
		bytes,
		userPage,
		acct,

		createFetcher() {
			if (this.iAmModerator) {
				return () => Promise.all([os.api('users/show', {
					userId: this.userId
				}), os.api('admin/show-user', {
					userId: this.userId
				})]).then(([user, info]) => {
					this.user = user;
					this.info = info;
					this.moderator = this.info.isModerator;
					this.silenced = this.info.isSilenced;
					this.localsilenced = this.info.isLocalSilenced;
					this.privatesilenced = this.info.isPrivateSilenced;
					this.forcesensitive = this.info.isForceSensitive;
					this.disabled = this.info.isDisabled;
					this.hidden = this.info.isHidden;
					this.suspended = this.info.isSuspended;
					this.capacity = this.info.capacity;
					this.usage = this.info.usage;
				});
			} else {
				return () => os.api('users/show', {
					userId: this.userId
				}).then((user) => {
					this.user = user;
				});
			}
		},

		refreshUser() {
			this.init = this.createFetcher();
		},

		async updateRemoteUser() {
			await os.apiWithDialog('federation/update-remote-user', { userId: this.user.id });
			this.refreshUser();
		},

		async resetPassword() {
			const confirm = await os.confirm({
				type: 'warning',
				text: this.$ts.resetPasswordConfirm,
			});
			if (confirm.canceled) {
				return;
			} else {
				const { password } = await os.api('admin/reset-password', {
					userId: this.user.id,
				});
				os.alert({
					type: 'success',
					text: this.$t('newPasswordIs', { password })
				});
			}
		},

		async toggleSilence(v) {
			const confirm = await os.confirm({
				type: 'warning',
				text: v ? this.$ts.silenceConfirm : this.$ts.unsilenceConfirm,
			});
			if (confirm.canceled) {
				this.silenced = !v;
			} else {
				await os.api(v ? 'admin/silence-user' : 'admin/unsilence-user', { userId: this.user.id });
				await this.refreshUser();
			}
		},

		async toggleLocalSilence(v) {
			const confirm = await os.confirm({
				type: 'warning',
				text: v ? this.$ts.silenceConfirm : this.$ts.unsilenceConfirm,
			});
			if (confirm.canceled) {
				this.localsilenced = !v;
			} else {
				await os.api(v ? 'admin/local-silence-user' : 'admin/local-unsilence-user', { userId: this.user.id });
				await this.refreshUser();
			}
		},

		async toggleprivatesilence(z) {
			const confirm = await os.confirm({
				type: 'warning',
				text: z ? this.$ts.silenceConfirm : this.$ts.unsilenceConfirm,
			});
			if (confirm.canceled) {
				this.privatesilenced = !z;
			} else {
				await os.api(z ? 'admin/private-silence-user' : 'admin/private-unsilence-user', { userId: this.user.id });
				await this.refreshUser();
			}
		},

		async toggleForceSensitive(v) {
			const confirm = await os.confirm({
				type: 'warning',
				text: v ? this.$ts.forcesensitiveConfirm : this.$ts.unforcesensitiveConfirm,
			});
			if (confirm.canceled) {
				this.forcesensitive = !v;
			} else {
				await os.api(v ? 'admin/force-sensitive-user' : 'admin/unforce-sensitive-user', { userId: this.user.id });
				await this.refreshUser();
			}
		},

		async toggleDisable(v) {
			const confirm = await os.confirm({
				type: 'warning',
				text: v ? this.$ts.accountdisableConfirm : this.$ts.accountenableConfirm,
			});
			if (confirm.canceled) {
				this.disabled = !v;
			} else {
				await os.api(v ? 'admin/disable-user' : 'admin/enable-user', { userId: this.user.id });
				await this.refreshUser();
			}
		},

		async toggleHide(v) {
			const confirm = await os.confirm({
				type: 'warning',
				text: v ? this.$ts.accountHideConfirm : this.$ts.accountUnhideConfirm,
			});
			if (confirm.canceled) {
				this.hidden = !v;
			} else {
				await os.api(v ? 'admin/hide-user' : 'admin/unhide-user', { userId: this.user.id });
				await this.refreshUser();
			}
		},

		async toggleSuspend(v) {
			const confirm = await os.confirm({
				type: 'warning',
				text: v ? this.$ts.suspendConfirm : this.$ts.unsuspendConfirm,
			});
			if (confirm.canceled) {
				this.suspended = !v;
			} else {
				await os.api(v ? 'admin/suspend-user' : 'admin/unsuspend-user', { userId: this.user.id });
				await this.refreshUser();
			}
		},

		async toggleModerator(v) {
			await os.api(v ? 'admin/moderators/add' : 'admin/moderators/remove', { userId: this.user.id });
			await this.refreshUser();
		},

		async sendModNotification() {
			const { canceled, result: comment } = await os.inputText({
				title: "Moderation Notification / 運営からのお知らせ",
			});
			if (canceled) return;
			await os.api('admin/send-notification', {
			 	comment: comment,
				userId: this.user.id,
			});
			os.success();
		},

		async deleteAllFiles() {
			const confirm = await os.confirm({
				type: 'warning',
				text: this.$ts.deleteAllFilesConfirm,
			});
			if (confirm.canceled) return;
			const process = async () => {
				await os.api('admin/delete-all-files-of-a-user', { userId: this.user.id });
				os.success();
			};
			await process().catch(e => {
				os.alert({
					type: 'error',
					text: e.toString()
				});
			});
			await this.refreshUser();
		},
	}
});
</script>

<style lang="scss" scoped>

@use "sass:math";

.aeakzknw {
	> .avatar {
		display: block;
		width: 64px;
		height: 64px;
	}
}

.uawsfosz {

	> .meter {
		$size: 12px;
		background: rgba(0, 0, 0, 0.1);
		border-radius: math.div($size, 2);
		overflow: hidden;

		> div {
			height: $size;
			border-radius: math.div($size, 2);
		}
	}
}
</style>
