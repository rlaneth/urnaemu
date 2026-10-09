"""Small, fail-closed reader for the subset used by the supplied TSE schemas.
Not a general ASN.1 implementation. No installed dependencies; reads schemas
as data and rejects unsupported syntax, tags, constraints and trailing bytes.
"""
import re

class Schema:
    tags={'INTEGER':2,'ENUMERATED':10,'OCTET STRING':4,'GeneralString':27,'NumericString':18,'BOOLEAN':1,'SEQUENCE':48,'SEQUENCE OF':48}
    def __init__(self,path):
        source=re.sub(r'--[^\n]*','',path.read_text())
        if 'DEFINITIONS IMPLICIT TAGS ::= BEGIN' not in source:raise ValueError('Unsupported module tagging')
        source=source.split('EXPORTS ALL;',1)[1].rsplit('END',1)[0]
        self.tokens=re.findall(r'::=|\.\.|[A-Za-z][A-Za-z0-9-]*|\d+|[{}(),\[\]]',source)
        if re.sub(r'\s+','',source)!=''.join(self.tokens):raise ValueError('Unsupported schema token')
        self.at=0;self.types={}
        while self.at<len(self.tokens):
            name=self.pop();self.pop('::=');self.types[name]=self.type()
    def pop(self,want=None):
        t=self.tokens[self.at];self.at+=1
        if want is not None and t!=want:raise ValueError(f'Expected {want}, got {t}')
        return t
    def peek(self):return self.tokens[self.at] if self.at<len(self.tokens) else None
    def type(self):
        tag=None
        if self.peek()=='[':self.pop();tag=int(self.pop());self.pop(']')
        kind=self.pop();t={'kind':kind}
        if kind=='OCTET':self.pop('STRING');t['kind']='OCTET STRING'
        if kind=='SEQUENCE' and self.peek()=='OF':self.pop();t.update(kind='SEQUENCE OF',element=self.type())
        elif kind in ('SEQUENCE','CHOICE','ENUMERATED'):
            self.pop('{');fields=[]
            while self.peek()!='}':
                name=self.pop()
                if kind=='ENUMERATED':self.pop('(');field=int(self.pop());self.pop(')');optional=False
                else:
                    field=self.type();optional=self.peek()=='OPTIONAL'
                    if optional:self.pop()
                fields.append((name,field,optional))
                if self.peek()!=',':break
                self.pop()
            self.pop('}');t['fields']=fields
        if self.peek()=='(':
            self.pop();size=self.peek()=='SIZE'
            if size:self.pop();self.pop('(')
            low=int(self.pop());high=low
            if self.peek()=='..':self.pop();high=int(self.pop())
            if size:self.pop(')')
            self.pop(')');t['constraint']=(size,low,high)
        if tag is not None:t['tag']=tag
        return t
    def resolve(self,t):
        if t['kind'] in self.types:return self.resolve(self.types[t['kind']])|{k:v for k,v in t.items() if k!='kind'}
        return t
    def accepted(self,t):
        t=self.resolve(t);kind=t['kind']
        if 'tag' in t:
            if kind=='CHOICE':return {160+t['tag']} # CHOICE gets an explicit wrapper.
            return {(160 if kind.startswith('SEQUENCE') else 128)+t['tag']}
        if kind=='CHOICE':return set().union(*(self.accepted(x[1]) for x in t['fields']))
        if kind not in self.tags:raise ValueError('Unsupported type '+kind)
        return {self.tags[kind]}
    def decode(self,name,data,check_constraints=True):
        node=parse(data);return self.value(self.types[name],node,name,check_constraints)
    def value(self,t,node,path,check):
        t=self.resolve(t);kind=t['kind'];tag,payload=node
        if tag not in self.accepted(t):raise ValueError(f'{path}: unexpected tag {tag:#x}')
        if kind=='CHOICE':
            if 'tag' in t:
                if len(payload)!=1:raise ValueError('Invalid explicit CHOICE')
                node=payload[0];tag=node[0]
            matches=[(n,f) for n,f,_ in t['fields'] if tag in self.accepted(f)]
            if len(matches)!=1:raise ValueError(path+': ambiguous CHOICE')
            n,f=matches[0];return {n:self.value(f,node,path+'.'+n,check)}
        if kind=='SEQUENCE':
            result={};i=0
            for n,f,optional in t['fields']:
                if i>=len(payload) or payload[i][0] not in self.accepted(f):
                    if optional:continue
                    raise ValueError(path+'.'+n+': missing or mistagged field')
                result[n]=self.value(f,payload[i],path+'.'+n,check);i+=1
            if i!=len(payload):raise ValueError(path+': extra fields')
            return result
        if kind=='SEQUENCE OF':return [self.value(t['element'],n,f'{path}[{i}]',check) for i,n in enumerate(payload)]
        if kind in ('INTEGER','ENUMERATED'):
            if not payload:raise ValueError('Empty integer')
            value=int.from_bytes(payload,'big',signed=True)
            if kind=='ENUMERATED' and value not in [x[1] for x in t['fields']]:raise ValueError(path+': unknown enumeration')
        elif kind=='BOOLEAN':
            if len(payload)!=1:raise ValueError('Invalid boolean')
            value=payload!=b'\0'
        elif kind=='OCTET STRING':value=payload
        else:
            value=payload.decode('cp1252' if kind=='GeneralString' else 'ascii')
            if kind=='NumericString' and not re.fullmatch(r'[0-9 ]*',value):raise ValueError(path+': invalid NumericString')
        if check and 'constraint' in t:
            size,lo,hi=t['constraint'];actual=len(value) if size else value
            if not lo<=actual<=hi:raise ValueError(f'{path}: constraint {lo}..{hi}, got {actual}')
        return value

def parse(data):
    def one(at,end,depth=0):
        if depth>100 or at+2>end:raise ValueError('Truncated/deep BER')
        tag=data[at];at+=1
        if tag&31==31:raise ValueError('High BER tags unsupported')
        n=data[at];at+=1
        if n&128:
            count=n&127
            if not count or count>4 or at+count>end:raise ValueError('Unsupported BER length')
            n=int.from_bytes(data[at:at+count],'big');at+=count
        stop=at+n
        if stop>end:raise ValueError('Truncated BER value')
        value=data[at:stop]
        if tag&32:
            value=[]
            while at<stop:
                child,at=one(at,stop,depth+1);value.append(child)
        return (tag,value),stop
    result,end=one(0,len(data))
    if end!=len(data):raise ValueError('Trailing BER bytes')
    return result
