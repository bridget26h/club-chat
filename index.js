import { createApp, ref, computed } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import { GraffitiPlugin, useGraffiti, useGraffitiSession, useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";

const DISCOVERY_CHANNEL = "designftw-26";

function loadComponent(name) {
    return () => import(`./${name}/main.js`).then((m) => m.default());
}

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: "/", component: loadComponent("home") },
        { path: "/club/:clubId", component: loadComponent("club"), props: true },
        { path: "/explore", component: loadComponent("explore") },
    ],
});

function setup() {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();
    const newClubName = ref("");
    const isCreating = ref(false);

    const calendarOffset = ref(0);
    const todayDate = new Date().getDate();
    const calendarDate = computed(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + calendarOffset.value); return d; });
    const calendarMonthLabel = computed(() => calendarDate.value.toLocaleString("default", { month: "long", year: "numeric" }));
    const calendarBlanks = computed(() => Array(calendarDate.value.getDay()).fill(null));
    const calendarDays = computed(() => { const days = new Date(calendarDate.value.getFullYear(), calendarDate.value.getMonth() + 1, 0).getDate(); return Array.from({ length: days }, (_, i) => i + 1); });
    const sidebarTab = ref("calendar");

    const saveActorChannel = computed(() =>
        session.value ? `${session.value.actor}/saved` : null
    );

    const { objects: savedItems } = useGraffitiDiscover(
        () => saveActorChannel.value ? [saveActorChannel.value] : [],
        { properties: { value: { required: ["activity","messageUrl","content","clubTitle"], properties: { activity: { const: "Save" }, messageUrl: { type: "string" }, content: { type: "string" }, clubTitle: { type: "string" } } } } }
    );

    async function unsaveItem(item) {
        await graffiti.delete(item, session.value);
    }

    const { objects: allClubObjects } = useGraffitiDiscover(
        [DISCOVERY_CHANNEL],
        { properties: { value: { required: ["activity","type","channel","title","published"], properties: { activity: { const: "Create" }, type: { const: "Club" }, channel: { type: "string" }, title: { type: "string" }, published: { type: "number" } } } } }
  );

    const joinActorChannel = computed(() => session.value ? `${session.value.actor}/clubs` : null);
    const { objects: joinObjects } = useGraffitiDiscover(
        () => joinActorChannel.value ? [joinActorChannel.value] : [],
        { properties: { value: { required: ["activity","target"], properties: { activity: { const: "Join" }, target: { type: "string" } } } } }
    );

    const joinObjectByChannel = computed(() => {
        const m = new Map();
        for (const obj of joinObjects.value) m.set(obj.value.target, obj);
        return m;
    });

    const joinedClubs = computed(() => {
        const channelToTitle = new Map();
        for (const c of allClubObjects.value) channelToTitle.set(c.value.channel, c.value.title);
        return joinObjects.value.map((obj) => ({
        channel: obj.value.target,
        title: obj.value.title || channelToTitle.get(obj.value.target) || "Unknown Club",
        }));
    });

    async function createClub() {
        if (!newClubName.value.trim()) return;
        isCreating.value = true;
        try {
        const newChannel = crypto.randomUUID();
        await graffiti.post({ value: { activity: "Create", type: "Club", channel: newChannel, title: newClubName.value.trim(), published: Date.now() }, channels: [DISCOVERY_CHANNEL] }, session.value);
        await graffiti.post({ value: { activity: "Join", target: newChannel, title: newClubName.value.trim(), published: Date.now() }, channels: [joinActorChannel.value] }, session.value);
        newClubName.value = "";
        router.push(`/club/${newChannel}`);
        } finally {
        isCreating.value = false;
        }
    }

    async function leaveClub(channel) {
        const joinObj = joinObjectByChannel.value.get(channel);
        if (!joinObj) return;
        await graffiti.delete(joinObj, session.value);
        router.push("/");
    }

    return {
        newClubName,
        isCreating,
        createClub,
        leaveClub,
        joinedClubs,
        calendarOffset,
        calendarMonthLabel,
        calendarBlanks,
        calendarDays,
        todayDate,
        sidebarTab,
        savedItems,
        unsaveItem,
    };
}

createApp({ template: "#template", setup })
    .use(router)
    .use(GraffitiPlugin, { graffiti: new GraffitiDecentralized() })
    .mount("#app");
