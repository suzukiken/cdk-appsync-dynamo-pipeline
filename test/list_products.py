import urllib.request
import json
import os
from string import Template
from pprint import pprint

schema = '''
  query { 
    listProducts { 
      id
      title
    }
  }
'''
data = json.dumps({ 'query': schema }).encode('utf-8')
headers = {
  'x-api-key': os.environ['API_KEY'],
  'Content-Type': 'application/graphql'
}
req = urllib.request.Request(url=os.environ['GRAPHQL_ENDPOINT'], data=data, headers=headers, method='POST')
f = urllib.request.urlopen(req)
pprint(json.loads(f.read().decode('utf-8')))
