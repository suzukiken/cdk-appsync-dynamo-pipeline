import urllib.request
import json
import os
from string import Template
from pprint import pprint

title = 'hello'

schema = '''
  mutation { 
    deleteProductsByTitle(title: "$title") { 
      id
    }
  }
'''

headers = {
  'x-api-key': os.environ['API_KEY'],
  'Content-Type': 'application/graphql'
}

query = Template(schema).substitute(title=title)
data = json.dumps({ 'query': query }).encode('utf-8')
req = urllib.request.Request(url=os.environ['GRAPHQL_ENDPOINT'], data=data, headers=headers, method='POST')
f = urllib.request.urlopen(req)
pprint(f.read().decode('utf-8'))
