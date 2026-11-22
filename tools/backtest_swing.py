import json, numpy as np
d=json.load(open('data.json')); demo=json.load(open('demo.json'))
E20,E23=d['elections']['nrsr2020'],d['elections']['nrsr2023']
MAP={'smer_sd':'smer_sd','sas':'sas','sns':'sns','lsns':'lsns','sme_rodina':'sme_rodina','kdh':'kdh','koalicia_ps_a_spolu':'ps','olano':'olano_a_priatelia_ku_a_za_ludi'}
codes=[c for c in E23['municipalities'] if c in E20['municipalities'] and c in demo and E23['municipalities'][c]['total_votes']>30 and E20['municipalities'][c]['total_votes']>30]
w=np.array([E23['municipalities'][c]['total_votes'] for c in codes],float)
V=np.array([demo[c] for c in codes],float)
# predictors like PRED (cols 0 = total)
def X():
    v=V; t=np.maximum(v[:,0],1)
    cols=[v[:,4]/t,v[:,2]/t,v[:,1]/t,v[:,5]/t,v[:,6]/t,v[:,7]/t,v[:,8]/t,v[:,9]/t,v[:,10]/t,np.log(t),v[:,12]/t,v[:,14]/np.maximum(v[:,13],1),v[:,15]/np.maximum(v[:,13],1),v[:,17]/t,v[:,18]/t]
    Z=np.array(cols).T; Z=(Z-np.average(Z,0,weights=w))/np.sqrt(np.average((Z-np.average(Z,0,weights=w))**2,0,weights=w)); return np.c_[np.ones(len(Z)),Z]
Z=X()
def ridge(y,lam=0.02):
    W=np.diag(w); A=Z.T@W@Z+lam*w.sum()*np.diag([0]+[1]*(Z.shape[1]-1)); return Z@np.linalg.solve(A,Z.T@W@y)
def sh(E,c,s): m=E['municipalities'][c]; return m['votes'].get(s,0)/m['total_votes']*100
res={}
for s20,s23 in MAP.items():
    b=np.array([sh(E20,c,s20) for c in codes]); a=np.array([sh(E23,c,s23) for c in codes])
    B=np.average(b,weights=w); A=np.average(a,weights=w); d_=A-B
    yh=ridge(b)
    out={}
    out['uniform']=np.maximum(b+d_,0)
    for g in (0.5,0.75,1.0):
        r=np.clip(b/B,0.05,4)**g; r=r/np.average(r,weights=w); out[f'prop{g}']=b+d_*r
    for lam in (0.3,0.5,0.7):
        r=np.clip((lam*b+(1-lam)*np.maximum(yh,0.2))/B,0.05,4); r=r/np.average(r,weights=w); out[f'blend{lam}']=b+d_*r
    out['flat_ratio']=b*A/B
    for k,p in out.items():
        p=np.maximum(p,0); p=p*(A/np.average(p,weights=w))  # match national exactly
        res.setdefault(k,[]).append(np.sqrt(np.average((p-a)**2,weights=w)))
    print(f'{s23[:12]:12s} nat {B:5.1f}->{A:5.1f}  rmse uniform {res["uniform"][-1]:.2f}  prop1 {res["prop1.0"][-1]:.2f} blend.5 {res["blend0.5"][-1]:.2f}')
print({k:round(float(np.mean(v)),3) for k,v in res.items()})
