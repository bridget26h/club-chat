import { ref, computed } from "vue";
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

    const saveActorChannel = computed(() => session.value ? `${session.value.actor}/saved` : null);
    const { objects: savedObjects } = useGraffitiDiscover(
        () => saveActorChannel.value ? [saveActorChannel.value] : [],
        { properties: { value: { required: ["activity","messageUrl"], properties: { activity: { const: "Save" }, messageUrl: { type: "string" } } } } }
    );
    const savedUrls = computed(() => {
        const s = new Set();
        for (const obj of savedObjects.value) s.add(obj.value.messageUrl);
        return s;
    });

    async function saveMessage(msg) {
        if (!saveActorChannel.value) return;
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

    async function sendMessage() {
        if (!myMessage.value.trim() || !clubId.value) return;
        isSending.value = true;
        try {
        await graffiti.post({ value: { content: myMessage.value.trim(), published: Date.now() }, channels: [clubId.value] }, session.value);
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
    };
}

export default async () => ({
    props: ["clubId"],
    setup,
    components: { MessageItem: await loadMessageComponent() },
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) => r.text()),
});
