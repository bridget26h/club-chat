import { computed, ref } from "vue";

function setup(props, { emit }) {
    const formattedTime = computed(() =>
        new Date(props.published).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );

    const showActions = ref(false);
    const menuOpen = ref(false);
    const showReactions = ref(false);
    const isEditing = ref(false);
    const editContent = ref('');
    const isPressing = ref(false);
    const menuAbove = ref(false);
    let pressTimer = null;
    let leaveTimer = null;

    function onMouseLeave() {
        leaveTimer = setTimeout(() => {
            showActions.value = false;
            menuOpen.value = false;
            showReactions.value = false;
        }, 75);
    }

    function onTouchStart() {
        isPressing.value = true;
        pressTimer = setTimeout(() => {
            isPressing.value = false;
            showActions.value = true;
        }, 500);
    }

    function onTouchEnd() {
        clearTimeout(pressTimer);
        isPressing.value = false;
    }

    function startEdit() {
        editContent.value = props.content;
        isEditing.value = true;
        menuOpen.value = false;
    }

    function cancelEdit() {
        isEditing.value = false;
        editContent.value = '';
    }

    function submitEdit() {
        if (editContent.value.trim()) {
            emit('edit', editContent.value.trim());
        }
        isEditing.value = false;
    }

    function doSave() {
        emit('save');
        menuOpen.value = false;
    }

    function doDelete() {
        if (confirm('Delete this message?')) {
            emit('delete');
        }
        menuOpen.value = false;
    }

    function doReply() {}

    function doReact(emoji) {
        emit('react', emoji);
        showReactions.value = false;
    }

    function toggleMenu(e) {
        menuOpen.value = !menuOpen.value;
        showReactions.value = false;
        if (menuOpen.value) {
            const rect = e.currentTarget.getBoundingClientRect();
            menuAbove.value = rect.top > 200;
            setTimeout(() => {
                document.addEventListener('click', () => { menuOpen.value = false; }, { once: true });
            }, 50);
        }
    }

    const reactionsAbove = ref(false);
    function toggleReactions(e) {
        showReactions.value = !showReactions.value;
        menuOpen.value = false;
        if (showReactions.value) {
            const rect = e.currentTarget.getBoundingClientRect();
            reactionsAbove.value = rect.top > 200;
            setTimeout(() => {
                document.addEventListener('click', () => { showReactions.value = false; }, { once: true });
            }, 50);
        }
    }

    function onActionsEnter() {
        clearTimeout(leaveTimer);
    }

    const groupedReactions = computed(() => {
        const map = new Map();
        for (const r of (props.reactions || [])) {
            const e = r.value.emoji;
            if (!map.has(e)) map.set(e, { emoji: e, count: 0, mine: false, actors: [] });
            map.get(e).count++;
            if (r.actor === props.currentActor) map.get(e).mine = true;
            map.get(e).actors.push(r.actor);
        }
        return [...map.values()];
    });

    function openReactionPopup(emoji, e) {
        emit('open-reactions', { groups: groupedReactions.value, msgUrl: props.url });
    }

    return {
        formattedTime,
        showActions,
        menuOpen,
        showReactions,
        isEditing,
        editContent,
        isPressing,
        isEdited: computed(() => props.edited),
        onMouseLeave,
        toggleMenu,
        toggleReactions,
        onTouchStart,
        onTouchEnd,
        startEdit,
        cancelEdit,
        submitEdit,
        doSave,
        doDelete,
        doReply,
        doReact,
        menuAbove,
        onActionsEnter,
        groupedReactions,
        openReactionPopup,
        reactionsAbove,
    };
}

export default async () => ({
    props: ["actor", "content", "published", "isOwner", "deleting", "saved", "edited", "reactions", "currentActor", "url"],
    emits: ["delete", "save", "edit", "react", "open-reactions"],
    setup,
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) => r.text()),
});
