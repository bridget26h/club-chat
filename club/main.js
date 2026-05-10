import { ref, computed, nextTick } from "vue";
import { useGraffiti, useGraffitiSession, useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";
import { useRouter } from "vue-router";

const DISCOVERY_CHANNEL = "designftw-26";

async function loadMessageComponent() {
    const factory = await import("../components/messages/main.js").then((m) => m.default());
    return factory;
}

function setup(props) {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();
    const router = useRouter();
    const clubId = computed(() => props.clubId);

    const showInfo = ref(false);
    const isEditing = ref(false);
    const editName = ref("");
    const editDescription = ref("");
    const editFile = ref(null);
    const editPreviewUrl = ref(null);
    const isSavingEdit = ref(false);

    const { objects: allClubObjects } = useGraffitiDiscover(
        [DISCOVERY_CHANNEL],
        { properties: { value: { required: ["activity","type","channel","title"], properties: { activity: { const: "Create" }, type: { const: "Club" }, channel: { type: "string" }, title: { type: "string" } } } } }
    );

    const clubObject = computed(() => allClubObjects.value.find((c) => c.value.channel === clubId.value));
    const clubTitle = computed(() => clubObject.value?.value.title || "Club");
    const clubDescription = computed(() => clubObject.value?.value.description || "");
    const clubIcon = computed(() => clubObject.value?.value.icon || null);
    const clubCreator = computed(() => clubObject.value?.actor || "");
    const isCreator = computed(() => session.value?.actor === clubCreator.value);
    const messageInput = ref(null);

    function autoResize() {
        const el = messageInput.value;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }

    async function sendMessage() {
        if (!myMessage.value.trim() || !clubId.value) return;
        isSending.value = true;
        try {
            await graffiti.post({ value: { content: myMessage.value.trim(), published: Date.now() }, channels: [clubId.value] }, session.value);
            await graffiti.post({
                value: {
                    activity: "LastMessage",
                    channel: clubId.value,
                    published: Date.now(),
                },
                channels: [DISCOVERY_CHANNEL],
            }, session.value);
            myMessage.value = "";
            await nextTick();
            if (messageInput.value) messageInput.value.style.height = 'auto';
            scrollToBottom();
        } finally {
            isSending.value = false;
        }
    }
    function scrollToBottom() {
        const wrap = document.querySelector('.messages-wrap');
        if (wrap) wrap.scrollTop = 0;
    }

    function startEdit() {
        editName.value = clubTitle.value;
        editDescription.value = clubDescription.value;
        editPreviewUrl.value = null;
        editFile.value = null;
        isEditing.value = true;
    }

    function handleEditFile(event) {
        const file = event.target.files[0];
        if (file) {
        editFile.value = file;
        editPreviewUrl.value = URL.createObjectURL(file);
        }
    }

    async function saveEdit() {
        if (!clubObject.value) return;

        const existingNames = allClubObjects.value
            .filter(c => c.value.channel !== clubId.value)
            .map(c => c.value.title.toLowerCase().trim());
        if (existingNames.includes(editName.value.toLowerCase().trim())) {
            alert(`A club named "${editName.value.trim()}" already exists. Please choose a different name.`);
            return;
        }

        isSavingEdit.value = true;
        try {
            const newValue = {
                activity: "Create",
                type: "Club",
                channel: clubId.value,
                title: editName.value.trim(),
                description: editDescription.value.trim(),
                published: Date.now(),
            };

            if (editFile.value) {
                newValue.icon = await graffiti.postMedia({ data: editFile.value }, session.value);
            } else if (clubIcon.value) {
                newValue.icon = clubIcon.value;
            }

            await graffiti.delete(clubObject.value, session.value);
            await graffiti.post({
                value: newValue,
                channels: [DISCOVERY_CHANNEL],
            }, session.value);
            isEditing.value = false;
        } finally {
            isSavingEdit.value = false;
        }
    }

    async function confirmDelete() {
        if (confirm(`Are you sure you want to delete "${clubTitle.value}" permanently? This cannot be undone.`)) {
            if (!clubObject.value) return;
            try {
                await graffiti.delete(clubObject.value, session.value);
            } catch (e) {
                console.warn("Could not delete club object:", e);
            }
            try {
                const joinObj = joinObjects.value.find(o => o.value.target === clubId.value);
                if (joinObj) await graffiti.delete(joinObj, session.value);
            } catch (e) {
                console.warn("Could not delete join record:", e);
            }
            router.push("/");
        }
    }

    const myMessage = ref("");
    const isSending = ref(false);
    const isDeleting = ref(new Set());

    const { objects: messageObjects, isFirstPoll: areMessagesLoading } = useGraffitiDiscover(
        () => clubId.value ? [clubId.value] : [],
        { properties: { value: { required: ["content","published"], properties: { content: { type: "string" }, published: { type: "number" } } } } },
        undefined, true
    );

    const sortedMessages = computed(() =>
        messageObjects.value.toSorted((a, b) => a.value.published - b.value.published)
    );
    const groupedMessages = computed(() => {
        const groups = [];
        let currentDate = null;
        for (const msg of sortedMessages.value) {
            const msgDate = new Date(msg.value.published).toDateString();
            if (msgDate !== currentDate) {
                currentDate = msgDate;
                const date = new Date(msg.value.published);
                const today = new Date();
                const yesterday = new Date();
                yesterday.setDate(today.getDate() - 1);
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(today.getDate() - 7);
                let label;
                if (msgDate === today.toDateString()) {
                    label = "Today at " + date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                }
                else if (msgDate === yesterday.toDateString()) {
                    label = "Yesterday at " + date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                }
                else if (date > sevenDaysAgo) {
                    label = date.toLocaleDateString([], { weekday: 'long' }) +
                            " at " + date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                }
                else {
                    label = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) +
                            " at " + date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                }
                groups.push({ type: 'label', label });
            }
            groups.push({ type: 'message', msg });
        }
        return groups.reverse();
    });

    const saveActorChannel = computed(() => session.value ? `${session.value.actor}/saved` : null);
    const { objects: savedObjects } = useGraffitiDiscover(
        () => saveActorChannel.value ? [saveActorChannel.value] : [],
        { properties: { value: { required: ["activity","messageUrl"], properties: { activity: { const: "Save" }, messageUrl: { type: "string" } } } } }
    );
    const { objects: reactionObjects } = useGraffitiDiscover(
        () => clubId.value ? [clubId.value] : [],
        { properties: { value: { required: ["activity","messageUrl","emoji"], properties: { activity: { const: "React" }, messageUrl: { type: "string" }, emoji: { type: "string" } } } } }
    );

    const reactionsByMessage = computed(() => {
        const map = new Map();
        for (const obj of reactionObjects.value) {
            const url = obj.value.messageUrl;
            if (!map.has(url)) map.set(url, []);
            map.get(url).push(obj);
        }
        return map;
    });

    async function reactToMessage(msgOrUrl, emoji) {
        if (!session.value) return;
        const msgUrl = typeof msgOrUrl === 'string' ? msgOrUrl : msgOrUrl.url;
        const existing = reactionObjects.value.find(
            o => o.value.messageUrl === msgUrl && o.actor === session.value.actor
        );
        if (existing) {
            if (existing.value.emoji === emoji) {
                await graffiti.delete(existing, session.value);
                return;
            }
            await graffiti.delete(existing, session.value);
        }
        await graffiti.post({
            value: {
                activity: "React",
                messageUrl: msgUrl,
                emoji,
                published: Date.now(),
            },
            channels: [clubId.value],
        }, session.value);
    }
    const reactionModal = ref({ open: false, groups: [], msgUrl: null });

    function openReactionModal({ groups, msgUrl }) {
        reactionModal.value = { open: true, groups, msgUrl };
    }
    const savedUrls = computed(() => {
        const s = new Set();
        for (const obj of savedObjects.value) s.add(obj.value.messageUrl);
        return s;
    });

    async function saveMessage(msg) {
        if (!saveActorChannel.value) return;
        const existing = savedObjects.value.find(o => o.value.messageUrl === msg.url);
        if (existing) {
            await graffiti.delete(existing, session.value);
        } else {
            await graffiti.post({
                value: {
                    activity: "Save",
                    messageUrl: msg.url,
                    content: msg.value.content,
                    actor: msg.actor,
                    clubId: clubId.value,
                    clubTitle: clubTitle.value,
                    published: Date.now(),
                },
                channels: [saveActorChannel.value],
            }, session.value);
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
    async function editMessage(msg, newContent) {
        await graffiti.delete(msg, session.value);
        await graffiti.post({
            value: {
                content: newContent,
                published: msg.value.published,
                edited: true,
            },
            channels: [clubId.value],
        }, session.value);
    }

    const joinActorChannel = computed(() => session.value ? `${session.value.actor}/clubs` : null);
    const { objects: joinObjects } = useGraffitiDiscover(
        () => joinActorChannel.value ? [joinActorChannel.value] : [],
        { properties: { value: { required: ["activity","target"], properties: { activity: { const: "Join" }, target: { type: "string" } } } } }
    );

    async function leaveCurrentClub() {
        const joinObj = joinObjects.value.find(o => o.value.target === clubId.value);
        if (!joinObj) return;
        await graffiti.delete(joinObj, session.value);
        router.push("/");
    }

    function confirmLeave() {
        if (confirm(`Are you sure you want to leave ${clubTitle.value}?`)) {
            leaveCurrentClub();
        }
    }

    return {
        clubTitle,
        clubDescription,
        clubIcon,
        clubCreator,
        isCreator,
        showInfo,
        isEditing,
        editName,
        editDescription,
        editPreviewUrl,
        isSavingEdit,
        startEdit,
        handleEditFile,
        saveEdit,
        confirmDelete,
        myMessage,
        isSending,
        isDeleting,
        sortedMessages,
        areMessagesLoading,
        sendMessage,
        deleteMessage,
        savedUrls,
        saveMessage,
        confirmLeave,
        autoResize,
        messageInput,
        groupedMessages,
        editMessage,
        reactionsByMessage,
        reactToMessage,
        reactionModal,
        openReactionModal,
    };
}

export default async () => ({
    props: ["clubId"],
    setup,
    components: { MessageItem: await loadMessageComponent() },
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) => r.text()),
});
