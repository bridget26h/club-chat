import { computed, ref } from "vue";

function setup(props, { emit }) {
    const formattedTime = computed(() =>
        new Date(props.published).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );

    const showDots = ref(false);
    const menuOpen = ref(false);
    const isEditing = ref(false);
    const editContent = ref('');

    function toggleMenu() {
        menuOpen.value = !menuOpen.value;
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
        emit('delete');
        menuOpen.value = false;
    }

    return {
        formattedTime,
        showDots,
        menuOpen,
        isEditing,
        editContent,
        isEdited: computed(() => props.edited),
        toggleMenu,
        startEdit,
        cancelEdit,
        submitEdit,
        doSave,
        doDelete,
    };
}

export default async () => ({
    props: ["actor", "content", "published", "isOwner", "deleting", "saved", "edited"],
    emits: ["delete", "save", "edit"],
    setup,
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) => r.text()),
});
