import { createApp, ref, computed } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import {
    GraffitiPlugin,
    useGraffiti,
    useGraffitiSession,
    useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

const DISCOVERY_CHANNEL = "designftw-26";

function setup() {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();
    const activeChannel = ref(null);
    const newClubName = ref("");
    const isCreating = ref(false);
    const searchQuery = ref("");
    const myMessage = ref("");
    const isSending = ref(false);
    const isDeleting = ref(new Set());
    const calendarOffset = ref(0);
    const todayDate = new Date().getDate();
    const calendarDate = computed(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + calendarOffset.value); return d; });
    const calendarMonthLabel = computed(() => calendarDate.value.toLocaleString("default", { month: "long", year: "numeric" }));
    const calendarBlanks = computed(() => Array(calendarDate.value.getDay()).fill(null));
    const calendarDays = computed(() => { const days = new Date(calendarDate.value.getFullYear(), calendarDate.value.getMonth() + 1, 0).getDate(); return Array.from({ length: days }, (_, i) => i + 1); });
    const { objects: allClubObjects } = useGraffitiDiscover(
        [DISCOVERY_CHANNEL],
        {
        properties: {
            value: {
            required: ["activity", "type", "channel", "title", "published"],
            properties: {
                activity: { const: "Create" },
                type: { const: "Club" },
                channel: { type: "string" },
                title: { type: "string" },
                published: { type: "number" },
            },
            },
        },
        }
    );

    const joinActorChannel = computed(() =>
        session.value ? `${session.value.actor}/clubs` : null
    );
    const { objects: joinObjects } = useGraffitiDiscover(
        () => (joinActorChannel.value ? [joinActorChannel.value] : []),
        {
        properties: {
            value: {
            required: ["activity", "target"],
            properties: {
                activity: { const: "Join" },
                target: { type: "string" },
            },
            },
        },
        }
    );
    const joinedChannels = computed(() => {
        const s = new Set();
        for (const obj of joinObjects.value) s.add(obj.value.target);
        return s;
    });
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

    const activeClubName = computed(() =>
        joinedClubs.value.find((c) => c.channel === activeChannel.value)?.title || null
    );
    const filteredAllClubs = computed(() => {
        const q = searchQuery.value.toLowerCase();
        return allClubObjects.value.filter((c) => c.value.title.toLowerCase().includes(q));
    });

    async function createClub() {
        if (!newClubName.value.trim()) return;
        isCreating.value = true;
        try {
        const newChannel = crypto.randomUUID();
        await graffiti.post(
            {
            value: {
                activity: "Create",
                type: "Club",
                channel: newChannel,
                title: newClubName.value.trim(),
                published: Date.now(),
            },
            channels: [DISCOVERY_CHANNEL],
            },
            session.value
        );
        await graffiti.post(
            {
            value: { activity: "Join", target: newChannel, title: newClubName.value.trim(), published: Date.now() },
            channels: [joinActorChannel.value],
            },
            session.value
        );
        activeChannel.value = newChannel;
        newClubName.value = "";
        } finally {
        isCreating.value = false;
        }
    }

    async function joinClub(clubObject) {
        await graffiti.post(
        {
            value: { activity: "Join", target: clubObject.value.channel, title: clubObject.value.title, published: Date.now() },
            channels: [joinActorChannel.value],
        },
        session.value
        );
        activeChannel.value = clubObject.value.channel;
        searchQuery.value = "";
    }

    async function leaveClub(channel) {
        const joinObj = joinObjectByChannel.value.get(channel);
        if (!joinObj) return;
        await graffiti.delete(joinObj, session.value);
        if (activeChannel.value === channel) activeChannel.value = null;
    }

    const { objects: messageObjects, isFirstPoll: areMessagesLoading } =
        useGraffitiDiscover(
        () => (activeChannel.value ? [activeChannel.value] : []),
        {
            properties: {
            value: {
                required: ["content", "published"],
                properties: {
                content: { type: "string" },
                published: { type: "number" },
                },
            },
            },
        },
        undefined,
        true
        );

    const sortedMessages = computed(() =>
        messageObjects.value.toSorted((a, b) => a.value.published - b.value.published)
    );

    async function sendMessage() {
        if (!myMessage.value.trim() || !activeChannel.value) return;
        isSending.value = true;
        try {
        await graffiti.post(
            {
            value: { content: myMessage.value.trim(), published: Date.now() },
            channels: [activeChannel.value],
            },
            session.value
        );
        myMessage.value = "";
        } finally {
        isSending.value = false;
        }
    }

    async function deleteMessage(msg) {
        isDeleting.value.add(msg.url);
        try {
        await graffiti.delete(msg, session.value);
        } finally {
        isDeleting.value.delete(msg.url);
        }
    }

    function formatTime(ts) {
        return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    return {
        activeChannel,
        activeClubName,
        newClubName,
        isCreating,
        searchQuery,
        filteredAllClubs,
        joinedClubs,
        joinedChannels,
        myMessage,
        isSending,
        isDeleting,
        sortedMessages,
        areMessagesLoading,
        createClub,
        joinClub,
        leaveClub,
        sendMessage,
        deleteMessage,
        formatTime,
        calendarOffset,
        calendarMonthLabel,
        calendarBlanks,
        calendarDays,
        todayDate,
    };
}

const App = { template: "#template", setup };

createApp(App)
.use(GraffitiPlugin, { graffiti: new GraffitiDecentralized() })
.mount("#app");
