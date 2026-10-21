def retrieve(vector_store, pokemon_id, query, regulation_id=None):
    """Always preserves selected metadata regardless of similarity rank."""
    return vector_store.retrieve(pokemon_id, query, regulation_id)
