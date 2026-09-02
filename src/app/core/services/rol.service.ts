import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Rol, RolActualizar, RolCrear } from '../models/rol.model';

@Injectable({ providedIn: 'root' })
export class RolService {
  private readonly baseUrl = `${environment.apiUrl}/roles`;

  constructor(private readonly http: HttpClient) {}

  listar(): Observable<Rol[]> {
    return this.http.get<Rol[]>(this.baseUrl);
  }

  crear(dto: RolCrear): Observable<Rol> {
    return this.http.post<Rol>(this.baseUrl, dto);
  }

  actualizar(id: number, dto: RolActualizar): Observable<Rol> {
    return this.http.put<Rol>(`${this.baseUrl}/${id}`, dto);
  }
}
