import os
import requests
import json

def get_function_source(name):
    # Since information_schema.routines routine_definition was nil, 
    # we can try pg_get_functiondef via a query if possible, or 
    # use the Supabase read_query with the specific postgres system table.
    pass

