"""Exercise rejection paths of the deliberately limited schema reader."""
from pathlib import Path
import sys,tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from tse_schema_reader import Schema
with tempfile.TemporaryDirectory() as tmp:
    p=Path(tmp)/'test.asn1'
    p.write_text('''Test DEFINITIONS IMPLICIT TAGS ::= BEGIN EXPORTS ALL;
Number ::= INTEGER (1..9)
Kind ::= ENUMERATED { first (1), second (2) }
Name ::= NumericString (SIZE(2))
Root ::= SEQUENCE { id [0] Number, kind Kind, name Name OPTIONAL }
END''')
    s=Schema(p)
    valid=bytes.fromhex('300a8001010a010112023132')
    assert s.decode('Root',valid)=={'id':1,'kind':1,'name':'12'}
    bad=[valid+b'\0',valid[:-1],valid.replace(b'\x80\x01\x01',b'\x81\x01\x01'),valid.replace(b'\x80\x01\x01',b'\x80\x01\x00'),valid.replace(b'\x0a\x01\x01',b'\x0a\x01\x03'),valid.replace(b'12',b'ab'),bytes.fromhex('30098001010a0101120131')]
    for encoded in bad:
        try:s.decode('Root',encoded)
        except ValueError:pass
        else:raise AssertionError('Malformed data accepted')
    p.write_text('Test DEFINITIONS IMPLICIT TAGS ::= BEGIN EXPORTS ALL; Root ::= SET OF INTEGER END')
    try:Schema(p)
    except (ValueError,IndexError):pass
    else:raise AssertionError('Unsupported syntax accepted')
print('PASS: wrong tags/enums/ranges/string lengths, malformed strings, truncation, trailing bytes and unsupported schema syntax rejected')
