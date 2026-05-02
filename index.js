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
    const clubSearch = ref("");
    const isCreating = ref(false);
    const sidebarTab = ref("calendar");

    const calendarOffset = ref(0);
    const todayDate = new Date().getDate();
    const today = new Date();
    const calendarDate = computed(() => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() + calendarOffset.value);
        return d;
    });

    const calendarMonthLabel = computed(() =>
        calendarDate.value.toLocaleString("default", { month: "long", year: "numeric" })
    );
    const calendarBlanks = computed(() => Array(calendarDate.value.getDay()).fill(null));
    const calendarDays = computed(() => {
        const days = new Date(calendarDate.value.getFullYear(), calendarDate.value.getMonth() + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => i + 1);
    });

    const calendarMonths = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const calendarYears = Array.from({ length: 20 }, (_, i) => today.getFullYear() - 5 + i);

    const calendarMonthSelect = computed({
        get: () => calendarDate.value.getMonth(),
        set: (val) => {
            const diff = val - today.getMonth();
            const yearDiff = (calendarDate.value.getFullYear() - today.getFullYear()) * 12;
            calendarOffset.value = yearDiff + diff;
        }
    });

    const calendarYearSelect = computed({
        get: () => calendarDate.value.getFullYear(),
        set: (val) => {
            const yearDiff = val - today.getFullYear();
            calendarOffset.value = yearDiff * 12 + (calendarDate.value.getMonth() - today.getMonth());
        }
    });

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

    const filteredJoinedClubs = computed(() => {
        const q = clubSearch.value.toLowerCase();
        return q ? joinedClubs.value.filter(c => c.title.toLowerCase().includes(q)) : joinedClubs.value;
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
        calendarMonthSelect,
        calendarYearSelect,
        calendarMonths,
        calendarYears,
        todayDate,
        sidebarTab,
        savedItems,
        unsaveItem,
        clubSearch,
        filteredJoinedClubs,
    };
}

createApp({ template: "#template", setup })
    .use(router)
    .use(GraffitiPlugin, { graffiti: new GraffitiDecentralized() })
    .mount("#app");
