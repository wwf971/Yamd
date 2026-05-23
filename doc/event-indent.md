

```
- a
  - b
    - c1
    - c2
  - d
- e
```
after selecting across b and c1, and outdent, the document should become:

```
- a
- b
  - c1
    - c2
  - d
- e
```

```
- a
  - b
    - c
  - d
    - e
```
after selecting from b to d, outdent should be rejected, because if d is outdented, e will have not parent.
indent should also be rejected, because after indenting b will not have parent.


```
- a
  - b
    - c
  - d
    - e
- f
```
after selecting from c to e and outdenting, the document should become:
```
- a
  - b
  - c
- d
  - e
- f
```



- a
  - b
    - c1
      - d
    - c2
      - e1
      - e2
    - f
  - g
  

  